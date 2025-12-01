import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlanService } from 'src/plan/plan.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MediaType } from '@prisma/client';

@Injectable()
export class UploadService {
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_KEY devem estar configurados nas variáveis de ambiente',
      );
    }

    // Normalizar URL do Supabase (remover trailing slash se houver)
    const normalizedUrl = supabaseUrl.replace(/\/$/, '');
    this.supabase = createClient(normalizedUrl, supabaseKey);
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: number,
  ): Promise<{ id: number; url: string; type: MediaType }> {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    // Determinar tipo de mídia baseado no mimetype
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');
    const isAudio = file.mimetype.startsWith('audio/');

    if (!isVideo && !isImage && !isAudio) {
      throw new BadRequestException(
        'Tipo de arquivo não suportado. Apenas imagens, vídeos e áudios são permitidos.',
      );
    }

    // Validação de plano para vídeos
    if (isVideo) {
      const hasVideoFeature = await this.planService.userHasFeature(
        userId,
        'VIDEO_BACKGROUND',
      );

      if (!hasVideoFeature) {
        throw new ForbiddenException('Upgrade to Flow/Epic to upload videos.');
      }
    }

    // Usar bucket_id exatamente como está no Supabase (case-sensitive)
    const bucketName = 'Backgrounds';

    // Gerar caminho único no Supabase
    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${userId}/${timestamp}_${sanitizedFileName}`;

    // Upload para Supabase Storage
    const { error: uploadError } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      // Mensagens de erro mais descritivas baseadas no erro do Supabase
      let errorMessage =
        uploadError.message || 'Erro desconhecido ao fazer upload';

      if (
        uploadError.message?.includes('Bucket not found') ||
        uploadError.message?.includes('not found')
      ) {
        // Tentar listar buckets para debug
        const { data: buckets } = await this.supabase.storage.listBuckets();
        const availableBuckets =
          buckets?.map((b) => `${b.name || b.id}`).join(', ') || 'nenhum';

        errorMessage = `Bucket '${bucketName}' não encontrado. Buckets disponíveis no Supabase: [${availableBuckets}]. Verifique se o bucket_id no dashboard é exatamente '${bucketName}' (case-sensitive).`;
      } else if (
        uploadError.message?.includes('new row violates row-level security') ||
        uploadError.message?.includes('RLS')
      ) {
        errorMessage = `Erro de permissão (RLS). Verifique as políticas do bucket '${bucketName}' no Supabase: Storage > Buckets > ${bucketName} > Policies. É necessário permitir INSERT para usuários autenticados.`;
      } else if (
        uploadError.message?.includes('JWT') ||
        uploadError.message?.includes('Invalid API key')
      ) {
        errorMessage = `Erro de autenticação Supabase. Verifique se SUPABASE_URL e SUPABASE_KEY (service_role) estão configurados corretamente no arquivo .env.`;
      } else if (uploadError.message?.includes('permission denied')) {
        errorMessage = `Permissão negada. Verifique se o bucket '${bucketName}' está público e as políticas RLS permitem upload para usuários autenticados.`;
      }

      throw new BadRequestException(errorMessage);
    }

    // Obter URL pública
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucketName).getPublicUrl(filePath);

    if (!publicUrl) {
      throw new BadRequestException('Erro ao obter URL pública do arquivo');
    }

    // Normalizar a URL para evitar duplicação
    let finalUrl = publicUrl;

    // Se a URL contém o domínio duplicado, corrigir
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (supabaseUrl && finalUrl.includes(supabaseUrl + supabaseUrl)) {
      // Remover duplicação
      finalUrl = finalUrl.replace(supabaseUrl + supabaseUrl, supabaseUrl);
    }

    // Garantir que começa com http
    if (!finalUrl.startsWith('http')) {
      finalUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
    }

    // Salvar no banco de dados
    // Nota: Áudios são tratados como IMAGE no banco por enquanto
    // (o enum MediaType só tem IMAGE e VIDEO)
    const mediaType: MediaType = isVideo ? MediaType.VIDEO : MediaType.IMAGE;

    const savedMedia = await this.prisma.media.create({
      data: {
        url: finalUrl,
        type: mediaType,
        userId,
        isActive: false, // Novo upload começa como inativo
      },
    });

    return {
      id: savedMedia.id,
      url: savedMedia.url,
      type: savedMedia.type,
    };
  }

  async getUserMedia(userId: number): Promise<
    Array<{
      id: number;
      url: string;
      type: MediaType;
      createdAt: Date;
    }>
  > {
    const media = await this.prisma.media.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        url: true,
        type: true,
        createdAt: true,
      },
    });

    return media;
  }

  /**
   * Retorna as URLs dos backgrounds pré-definidos do Supabase Storage
   * Os backgrounds estão na pasta "background-defined/" do bucket "Backgrounds"
   * Retorna URLs para diferentes extensões possíveis (jpg, png, webp)
   */
  async getPresetBackgroundUrls(): Promise<{
    forest: string | null;
    ocean: string | null;
    mountains: string | null;
    library: string | null;
    minimal: string | null;
  }> {
    const bucketName = 'Backgrounds';

    // Retorna as URLs públicas dos backgrounds pré-definidos
    // Tenta jpg primeiro, depois png, depois webp
    const getUrl = (
      backgroundId: string,
      extension: string = 'jpg',
    ): string | null => {
      const filePath = `background-defined/${backgroundId}.${extension}`;
      const {
        data: { publicUrl },
      } = this.supabase.storage.from(bucketName).getPublicUrl(filePath);

      // O getPublicUrl do Supabase sempre retorna uma URL válida
      if (!publicUrl) {
        return null;
      }

      let normalizedUrl = publicUrl.trim();

      // Corrigir duplicação de domínio (ex: https://xxx.supabase.cohttps//xxx.supabase.co)
      // Padrão específico: https://xxx.supabase.cohttps//xxx.supabase.co
      normalizedUrl = normalizedUrl.replace(
        /(https?:\/\/[^\/]+)https\/\//g,
        '$1/',
      );

      // Corrigir duplicação completa do domínio (ex: https://xxx.supabase.cohttps://xxx.supabase.co)
      const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
      if (supabaseUrl) {
        // Verificar duplicação exata do domínio
        const doubleUrl = supabaseUrl + supabaseUrl;
        if (normalizedUrl.includes(doubleUrl)) {
          normalizedUrl = normalizedUrl.replace(doubleUrl, supabaseUrl);
        }
      }

      return normalizedUrl;
    };

    // Retorna URLs para todas as extensões possíveis
    // Tenta diferentes extensões até encontrar uma que exista
    const tryGetUrl = (backgroundId: string): string | null => {
      const extensions = ['jpg', 'png', 'webp', 'jpeg'];
      for (const ext of extensions) {
        const url = getUrl(backgroundId, ext);
        if (url) {
          return url;
        }
      }
      return null;
    };

    return {
      forest: tryGetUrl('forest'),
      ocean: tryGetUrl('ocean'),
      mountains: tryGetUrl('mountains'),
      library: tryGetUrl('library'),
      minimal: tryGetUrl('minimal'),
    };
  }

  async deleteMedia(mediaId: number, userId: number): Promise<void> {
    // Verificar se a mídia pertence ao usuário
    const media = await this.prisma.media.findFirst({
      where: {
        id: mediaId,
        userId,
        deletedAt: null,
      },
    });

    if (!media) {
      throw new BadRequestException(
        'Mídia não encontrada ou você não tem permissão para excluí-la',
      );
    }

    // Extrair o caminho do arquivo da URL do Supabase
    // A URL do Supabase é: https://xxx.supabase.co/storage/v1/object/public/Backgrounds/{userId}/{filename}
    const bucketName = 'Backgrounds';
    let filePath = '';

    try {
      const url = new URL(media.url);
      const pathParts = url.pathname.split('/').filter((p) => p);

      // Encontrar o índice do bucket na URL
      const bucketIndex = pathParts.findIndex(
        (p) => p.toLowerCase() === bucketName.toLowerCase(),
      );

      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        // Pega tudo após o nome do bucket
        filePath = pathParts.slice(bucketIndex + 1).join('/');
      } else {
        // Fallback: tentar extrair diretamente
        const match = media.url.match(/\/Backgrounds\/(.+)$/i);
        if (match) {
          filePath = match[1];
        }
      }

      // Excluir do Supabase Storage apenas se encontrou o caminho
      if (filePath) {
        const { error: deleteError } = await this.supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (deleteError) {
          // Log do erro mas continua com a exclusão do banco
          console.error(
            'Erro ao excluir arquivo do Supabase:',
            deleteError.message,
          );
        }
      }
    } catch (error) {
      // Se houver erro ao extrair o path, continua com a exclusão do banco
      console.error('Erro ao processar URL para exclusão:', error);
    }

    // Excluir do banco de dados (hard delete)
    await this.prisma.media.delete({
      where: {
        id: mediaId,
      },
    });
  }
}
