import { Injectable, BadRequestException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class FocusSoundsService {
  private supabase: SupabaseClient;

  constructor() {
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

  /**
   * Faz upload de um áudio de foco para o Supabase Storage
   * Os áudios são armazenados no bucket "Backgrounds" na pasta "focus-sounds/"
   */
  async uploadFocusSound(
    file: Express.Multer.File,
    soundType: 'rain' | 'ocean' | 'fireplace' | 'lofi',
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    if (!file.mimetype.startsWith('audio/')) {
      throw new BadRequestException(
        'Tipo de arquivo não suportado. Apenas áudios são permitidos.',
      );
    }

    const bucketName = 'Backgrounds';
    const filePath = `focus-sounds/${soundType}.mp3`;

    // Upload para Supabase Storage (usa upsert para substituir se já existir)
    const { error: uploadError } = await this.supabase.storage
      .from(bucketName)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Permite substituir se já existir
      });

    if (uploadError) {
      throw new BadRequestException(
        `Erro ao fazer upload do áudio: ${uploadError.message}`,
      );
    }

    // Obter URL pública
    const {
      data: { publicUrl },
    } = this.supabase.storage.from(bucketName).getPublicUrl(filePath);

    if (!publicUrl) {
      throw new BadRequestException('Erro ao obter URL pública do áudio');
    }

    // Garantir que a URL está correta (sem duplicação)
    // Se a URL já começar com http, usar diretamente
    // Caso contrário, construir manualmente
    let finalUrl = publicUrl;
    if (!publicUrl.startsWith('http')) {
      const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, ''); // Remove trailing slash
      finalUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${filePath}`;
    }

    return { url: finalUrl };
  }

  /**
   * Retorna as URLs dos sons de foco do Supabase Storage
   * Retorna as URLs públicas mesmo que os arquivos ainda não existam
   * (o frontend pode verificar se o arquivo existe ao tentar reproduzir)
   */
  async getFocusSoundUrls(): Promise<{
    rain: string | null;
    ocean: string | null;
    fireplace: string | null;
    lofi: string | null;
  }> {
    const bucketName = 'Backgrounds';

    // Retorna as URLs públicas dos áudios
    // Se os arquivos não existirem ainda, as URLs ainda serão geradas
    // O frontend pode verificar se o arquivo existe ao tentar reproduzir
    const getUrl = (soundType: string): string | null => {
      const filePath = `focus-sounds/${soundType}.mp3`;
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

    return {
      rain: getUrl('rain'),
      ocean: getUrl('ocean'),
      fireplace: getUrl('fireplace'),
      lofi: getUrl('lofi'),
    };
  }
}
