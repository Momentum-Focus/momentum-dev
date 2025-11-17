import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { decrypt } from './helpers/encryption.helper';

@Injectable()
export class YouTubeService {
  private readonly youtubeApiKey: string;

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
  async search(query: string, maxResults: number = 10) {
    try {
      const response = await firstValueFrom(
        this.httpService.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: query,
            type: 'video',
            maxResults,
            key: this.youtubeApiKey,
          },
        }),
      );

      return response.data.items.map((item: any) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
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
    try {
      return decrypt(encryptedToken);
    } catch (error) {
      throw new Error('Erro ao descriptografar token do Google');
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
   * Obtém a playlist do usuário (requer token do usuário)
   */
  async getUserPlaylists(accessToken: string, maxResults: number = 50) {
    try {
      const response = await firstValueFrom(
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

      return response.data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.default.url,
        itemCount: item.contentDetails.itemCount,
      }));
    } catch (error: any) {
      throw new Error(
        `Erro ao obter playlists: ${error.response?.data?.error?.message || error.message}`,
      );
    }
  }
}

