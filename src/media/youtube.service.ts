import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { decrypt } from './helpers/encryption.helper';

@Injectable()
export class YouTubeService {
  private readonly youtubeApiKey: string;
  private readonly logger = new Logger(YouTubeService.name);

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.youtubeApiKey =
      this.configService.get<string>('YOUTUBE_API_KEY') || '';
  }

  /**
   * Busca vídeos/músicas no YouTube usando a API pública (requer YOUTUBE_API_KEY)
   */
  async search(
    query: string,
    maxResults: number = 10,
    musicOnly: boolean = false,
  ) {
    try {
      const params: any = {
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        key: this.youtubeApiKey,
      };

      // Filtro Music Mode: videoCategoryId=10 é a categoria "Music"
      if (musicOnly) {
        params.videoCategoryId = '10';
      }

      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/youtube/v3/search', {
          params,
        }),
      );

      if (!response.data || !response.data.items) {
        return [];
      }

      return response.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail:
          item.snippet.thumbnails?.default?.url ||
          item.snippet.thumbnails?.medium?.url ||
          '',
        channelTitle: item.snippet.channelTitle,
      }));
    } catch (error: any) {
      throw new Error(
        `Erro ao buscar no YouTube: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /**
   * Obtém o access token descriptografado do usuário
   */
  async getUserAccessToken(encryptedToken: string): Promise<string> {
    if (!encryptedToken) {
      throw new Error('Token criptografado não fornecido');
    }

    if (typeof encryptedToken !== 'string') {
      throw new Error('Token criptografado deve ser uma string');
    }

    // Verifica se o token está no formato correto (iv:encrypted)
    if (!encryptedToken.includes(':')) {
      throw new Error(
        'Token criptografado está em formato inválido. Pode ser necessário reconectar sua conta do YouTube Music.',
      );
    }

    try {
      return decrypt(encryptedToken);
    } catch (error: any) {
      // Detecta se é erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        error.message?.includes('bad decrypt') ||
        error.message?.includes('chave diferente');

      // Só loga como erro se não for bad decrypt (que será tratado pelo controller)
      if (!isBadDecrypt) {
        this.logger.error('Erro ao descriptografar token do Google:', {
          error: error.message,
          tokenLength: encryptedToken.length,
        });
      }

      throw new Error(
        `Erro ao descriptografar token do Google: ${error.message}. Pode ser necessário reconectar sua conta do YouTube Music.`,
      );
    }
  }

  /**
   * Controla a reprodução de vídeo no YouTube (requer token do usuário)
   * Nota: A API do YouTube não permite controle direto de reprodução via API pública.
   * Este método pode ser usado para obter informações do vídeo ou playlist.
   */
  async getVideoInfo(videoId: string, accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            part: 'snippet,contentDetails',
            id: videoId,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      if (response.data.items.length === 0) {
        throw new Error('Vídeo não encontrado');
      }

      const item = response.data.items[0];
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.medium.url,
        duration: item.contentDetails.duration,
        channelTitle: item.snippet.channelTitle,
      };
    } catch (error: any) {
      throw new Error(
        `Erro ao obter informações do vídeo: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /**
   * Obtém o canal do usuário (requer token do usuário)
   */
  async getUserChannel(accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/youtube/v3/channels', {
          params: {
            part: 'snippet,contentDetails',
            mine: true,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      if (
        !response.data ||
        !response.data.items ||
        response.data.items.length === 0
      ) {
        return null;
      }

      return response.data.items[0];
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;

      // Se o canal não existe, retorna null
      if (
        error.response?.status === 404 ||
        errorMessage?.includes('Channel not found')
      ) {
        return null;
      }

      throw new Error(`Erro ao obter canal do YouTube: ${errorMessage}`);
    }
  }

  /**
   * Obtém a playlist do usuário (requer token do usuário)
   * Primeiro verifica se o usuário tem um canal do YouTube
   *
   * @param accessToken - Token de acesso do Google
   * @param maxResults - Número máximo de resultados
   * @param onTokenRefresh - Callback opcional para atualizar token após refresh
   * @returns Array de playlists do usuário
   */
  async getUserPlaylists(
    accessToken: string,
    maxResults: number = 50,
    onTokenRefresh?: (newToken: string) => Promise<void>,
  ) {
    // Guard Clause: Token obrigatório
    if (
      !accessToken ||
      typeof accessToken !== 'string' ||
      accessToken.trim() === ''
    ) {
      throw new Error('Token de acesso do YouTube não fornecido ou inválido');
    }

    try {
      // Primeiro, verifica se o usuário tem um canal
      let channel = null;
      try {
        channel = await this.getUserChannel(accessToken);
      } catch (channelError: any) {
        this.logger.warn(
          'Erro ao buscar canal do usuário:',
          channelError.message,
        );
        // Continua mesmo sem canal - pode funcionar para alguns casos
      }

      // Tenta buscar playlists mesmo sem canal (pode funcionar em alguns casos)
      let response;
      try {
        response = await firstValueFrom(
          this.httpService.get(
            'https://www.googleapis.com/youtube/v3/playlists',
            {
              params: {
                part: 'snippet,contentDetails',
                mine: true,
                maxResults,
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          ),
        );
      } catch (firstAttemptError: any) {
        // Se der 401 na primeira tentativa, lança erro para o controller fazer refresh
        if (firstAttemptError.response?.status === 401) {
          throw new Error(
            `Token expirado ou inválido. Detalhes: ${firstAttemptError.response?.data?.error?.message || 'Unauthorized'}`,
          );
        }
        // Para outros erros, propaga
        throw firstAttemptError;
      }

      if (!response.data || !response.data.items) {
        if (!channel) {
          this.logger.warn(
            'Usuário não tem canal do YouTube. Algumas playlists podem não estar disponíveis.',
          );
          return [];
        }
        return [];
      }

      return response.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.default?.url || null,
        itemCount: item.contentDetails.itemCount || 0,
      }));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      const errorCode = error.response?.data?.error?.code;
      const statusCode = error.response?.status;

      // Se o canal não foi encontrado (404) - usuário pode não ter canal do YouTube Music
      if (statusCode === 404 || errorMessage?.includes('Channel not found')) {
        this.logger.log(
          'Canal do YouTube não encontrado. O usuário precisa criar um canal do YouTube primeiro.',
        );
        return [];
      }

      // Se o token expirou (401) - lança erro para o controller fazer refresh
      if (statusCode === 401) {
        this.logger.warn(
          'Token expirado (401). Controller deve fazer refresh automático.',
        );
        throw new Error(
          `Token expirado ou inválido. Detalhes: ${errorMessage}`,
        );
      }

      // Se excedeu quota (403)
      if (statusCode === 403) {
        const quotaError =
          errorMessage?.includes('quota') || errorMessage?.includes('Quota');
        this.logger.error('Erro 403 - Quota excedida ou acesso negado:', {
          errorMessage,
          errorCode,
          quotaError,
        });
        throw new Error(
          quotaError
            ? 'Quota da API do YouTube excedida. Tente novamente mais tarde.'
            : `Acesso negado pela API do YouTube. Detalhes: ${errorMessage}`,
        );
      }

      // Log detalhado para outros erros
      this.logger.error('Erro ao buscar playlists do YouTube:', {
        message: errorMessage,
        code: errorCode,
        status: statusCode,
        hasResponseData: !!error.response?.data,
      });

      throw new Error(`Erro ao obter playlists do YouTube: ${errorMessage}`);
    }
  }

  /**
   * Obtém os vídeos de uma playlist específica (requer token do usuário)
   */
  async getPlaylistItems(
    playlistId: string,
    accessToken: string,
    maxResults: number = 50,
  ) {
    // Guard Clause: Token obrigatório
    if (
      !accessToken ||
      typeof accessToken !== 'string' ||
      accessToken.trim() === ''
    ) {
      throw new Error('Token de acesso do YouTube não fornecido ou inválido');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://www.googleapis.com/youtube/v3/playlistItems',
          {
            params: {
              part: 'snippet,contentDetails',
              playlistId,
              maxResults,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        ),
      );

      if (!response.data || !response.data.items) {
        return [];
      }

      return response.data.items.map((item: any) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
        channelTitle: item.snippet.channelTitle,
        position: item.snippet.position,
      }));
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message || error.message;
      const statusCode = error.response?.status;

      // Se o token expirou (401) - lança erro para o controller fazer refresh
      if (statusCode === 401) {
        this.logger.warn(
          'Token expirado (401) ao buscar itens da playlist. Controller deve fazer refresh automático.',
        );
        throw new Error(
          `Token expirado ou inválido. Detalhes: ${errorMessage}`,
        );
      }

      // Se a playlist não foi encontrada (404)
      if (statusCode === 404) {
        throw new Error(
          `Playlist não encontrada ou não acessível. Detalhes: ${errorMessage}`,
        );
      }

      throw new Error(`Erro ao obter vídeos da playlist: ${errorMessage}`);
    }
  }

  /**
   * Obtém informações de uma playlist específica (para validação)
   */
  async getPlaylistInfo(playlistId: string, accessToken: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(
          'https://www.googleapis.com/youtube/v3/playlists',
          {
            params: {
              part: 'snippet,contentDetails',
              id: playlistId,
            },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        ),
      );

      if (
        !response.data ||
        !response.data.items ||
        response.data.items.length === 0
      ) {
        throw new Error('Playlist não encontrada');
      }

      const playlist = response.data.items[0];
      return {
        id: playlist.id,
        title: playlist.snippet.title,
        description: playlist.snippet.description,
        thumbnail: playlist.snippet.thumbnails?.default?.url || null,
        itemCount: playlist.contentDetails.itemCount || 0,
      };
    } catch (error: any) {
      throw new Error(
        `Erro ao obter informações da playlist: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}
