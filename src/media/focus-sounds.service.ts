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

    this.supabase = createClient(supabaseUrl, supabaseKey);
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

    return { url: publicUrl };
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
    const getUrl = (soundType: string) => {
      const filePath = `focus-sounds/${soundType}.mp3`;
      const {
        data: { publicUrl },
      } = this.supabase.storage.from(bucketName).getPublicUrl(filePath);
      return publicUrl;
    };

    return {
      rain: getUrl('rain'),
      ocean: getUrl('ocean'),
      fireplace: getUrl('fireplace'),
      lofi: getUrl('lofi'),
    };
  }
}
