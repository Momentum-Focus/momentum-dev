import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { decrypt, encrypt } from './helpers/encryption.helper';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType, MediaProvider } from '@prisma/client';
import type { Express } from 'express';

@Injectable()
export class MediaService {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  /**
   * Retorna o status de conexão do Spotify para um usuário
   */
  async getSpotifyConnectionStatus(userId: number): Promise<{
    isConnected: boolean;
    isPremium: boolean;
  }> {
    const user = await this.userService.findUserByID(userId);

    // Se não tem spotifyProduct salvo mas está conectado, tenta buscar
    if (user.isSpotifyConnected && !user.spotifyProduct) {
      try {
        const accessToken = await this.getSpotifyAccessToken(userId);
        if (accessToken) {
          const meResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();
            const rawProduct = meData.product || null;

            // Normaliza o product: "premium", "premium_family", "premium_duo" -> "premium"
            let spotifyProduct: string | null = null;
            if (rawProduct) {
              if (rawProduct.toLowerCase().includes('premium')) {
                spotifyProduct = 'premium';
              } else if (
                rawProduct.toLowerCase() === 'free' ||
                rawProduct.toLowerCase() === 'open'
              ) {
                spotifyProduct = rawProduct.toLowerCase();
              } else {
                spotifyProduct = rawProduct;
              }
            }

            // Atualiza o spotifyProduct no banco
            if (spotifyProduct) {
              await this.userService.updateSpotifyTokens(
                userId,
                user.spotifyAccessToken!,
                user.spotifyRefreshToken!,
                spotifyProduct,
              );
            }
          }
        }
      } catch (error) {
        // Erro silencioso - não loga para não poluir o console
      }
    }

    // Busca novamente para pegar o valor atualizado
    const updatedUser = await this.userService.findUserByID(userId);
    return {
      isConnected: updatedUser.isSpotifyConnected || false,
      isPremium: updatedUser.spotifyProduct === 'premium',
    };
  }

  /**
   * Descriptografa e retorna o access token do Spotify para um usuário
   * Tenta renovar o token se estiver expirado
   * NUNCA retorna erro 400 se houver refresh token disponível
   */
  async getSpotifyAccessToken(userId: number): Promise<string | null> {
    const user = await this.userService.findUserByID(userId);

    // Se não está conectado, retorna null
    if (!user.isSpotifyConnected) {
      return null;
    }

    // Se não tem nenhum token, retorna null
    if (!user.spotifyAccessToken && !user.spotifyRefreshToken) {
      return null;
    }

    // Se access token não existe mas refresh token existe, tenta fazer refresh imediatamente
    if (!user.spotifyAccessToken && user.spotifyRefreshToken) {
      const refreshedToken = await this.refreshSpotifyToken(userId);
      if (refreshedToken) {
        return refreshedToken;
      }
      // Se o refresh falhar, retorna null (não lança erro)
      return null;
    }

    // Se não tem access token mas tem refresh, tenta renovar
    if (!user.spotifyAccessToken && user.spotifyRefreshToken) {
      const refreshedToken = await this.refreshSpotifyToken(userId);
      if (refreshedToken) {
        return refreshedToken;
      }
      return null;
    }

    try {
      // Verifica se o access token existe antes de descriptografar
      if (!user.spotifyAccessToken) {
        // Se não tem access token mas tem refresh, tenta renovar
        if (user.spotifyRefreshToken) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
        }
        return null;
      }

      let accessToken: string;
      try {
        accessToken = decrypt(user.spotifyAccessToken);
      } catch (decryptError: any) {
        // Erro de descriptografia indica que o token foi criptografado com chave diferente
        // Tenta renovar usando refresh token antes de limpar
        if (user.spotifyRefreshToken) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
        }

        // Se não conseguiu renovar, limpa os tokens corrompidos
        await this.userService.disconnectSpotify(userId).catch(() => {});
        return null;
      }

      if (!accessToken || accessToken.trim() === '') {
        // Token vazio após descriptografia - tenta refresh se disponível
        if (user.spotifyRefreshToken) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
        }
        // Se não conseguiu renovar, limpa silenciosamente
        await this.userService.disconnectSpotify(userId).catch(() => {});
        return null;
      }

      // Valida o token fazendo uma requisição simples à API do Spotify
      try {
        const testResponse = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        // Se o token estiver expirado (401) ou inválido, tenta renovar IMEDIATAMENTE
        if (
          (testResponse.status === 401 || testResponse.status === 403) &&
          user.spotifyRefreshToken
        ) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
          // Se o refresh falhar, ainda tenta retornar o token atual (pode ser problema temporário)
        }

        // Se o token for válido, retorna
        if (testResponse.ok) {
          return accessToken;
        }

        // Se chegou aqui e ainda tem refresh token, tenta renovar como último recurso
        if (user.spotifyRefreshToken) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
        }
      } catch (testError: any) {
        // Se houver erro na validação (rede, etc), tenta renovar se tiver refresh token
        if (user.spotifyRefreshToken) {
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            return refreshedToken;
          }
        }
        // Se não conseguiu renovar, tenta usar o token mesmo assim (pode ser problema de rede temporário)
        console.warn(
          'Erro ao validar token do Spotify, usando token mesmo assim:',
          testError,
        );
      }

      return accessToken;
    } catch (error: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isDecryptError =
        error.message?.includes('bad decrypt') ||
        error.message?.includes('chave diferente') ||
        error.message?.includes('descriptografar');

      if (isDecryptError) {
        console.error(
          '[MediaService] ERRO CRÍTICO: Erro de descriptografia detectado:',
          {
            error: error.message,
            userId,
            hasAccessToken: !!user.spotifyAccessToken,
            hasRefreshToken: !!user.spotifyRefreshToken,
          },
        );

        // Se tiver refresh token, tenta renovar antes de limpar
        if (user.spotifyRefreshToken) {
          console.log(
            '[MediaService] Tentando renovar usando refresh token antes de limpar...',
          );
          const refreshedToken = await this.refreshSpotifyToken(userId);
          if (refreshedToken) {
            console.log(
              '[MediaService] Token renovado com sucesso após erro de descriptografia',
            );
            return refreshedToken;
          }
        }

        // Se não conseguiu renovar, limpa os tokens corrompidos
        const currentUser = await this.userService.findUserByID(userId);
        if (currentUser.isSpotifyConnected && currentUser.spotifyAccessToken) {
          await this.userService.disconnectSpotify(userId).catch(() => {});
        }
        return null;
      }

      // Outros erros - tenta renovar se tiver refresh token
      if (user.spotifyRefreshToken) {
        const refreshedToken = await this.refreshSpotifyToken(userId);
        if (refreshedToken) {
          return refreshedToken;
        }
      }

      // Se não conseguiu renovar, limpa silenciosamente
      const currentUser = await this.userService.findUserByID(userId);
      if (currentUser.isSpotifyConnected && currentUser.spotifyAccessToken) {
        await this.userService.disconnectSpotify(userId).catch(() => {});
      }

      return null;
    }
  }

  /**
   * Renova o access token do Spotify usando o refresh token
   */
  private async refreshSpotifyToken(userId: number): Promise<string | null> {
    const user = await this.userService.findUserByID(userId);

    if (!user.spotifyRefreshToken) {
      return null;
    }

    let refreshToken: string;
    try {
      refreshToken = decrypt(user.spotifyRefreshToken);
    } catch (decryptError: any) {
      // Erro de descriptografia indica que o token foi criptografado com chave diferente
      // Limpa os tokens corrompidos silenciosamente
      try {
        await this.userService.disconnectSpotify(userId);
      } catch (disconnectError) {
        // Erro ao limpar tokens - ignora silenciosamente
      }

      return null;
    }

    const clientId = this.configService.get<string>('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get<string>(
      'SPOTIFY_CLIENT_SECRET',
    );

    if (!clientId || !clientSecret) {
      return null;
    }

    try {
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Spotify pode retornar um novo refresh_token, usar ele se disponível
      const newRefreshToken = data.refresh_token
        ? encrypt(data.refresh_token)
        : user.spotifyRefreshToken; // Mantém o antigo se não vier novo

      // Aguarda completamente a atualização dos tokens no banco
      await this.userService.updateSpotifyTokens(
        userId,
        encrypt(data.access_token),
        newRefreshToken,
      );

      // Verifica se o token foi salvo corretamente
      const updatedUser = await this.userService.findUserByID(userId);
      if (!updatedUser.spotifyAccessToken) {
        throw new Error('Falha ao verificar salvamento do token renovado');
      }

      return data.access_token;
    } catch (error: any) {
      // Erro silencioso - não loga para não poluir o console
      return null;
    }
  }

  /**
   * Retorna o status de conexão do Google/YouTube Music para um usuário
   */
  async getGoogleConnectionStatus(userId: number): Promise<{
    isConnected: boolean;
  }> {
    const user = await this.userService.findUserByID(userId);
    return {
      isConnected: user.isGoogleConnected || false,
    };
  }

  /**
   * Renova o access token do Google usando o refresh token
   */
  async refreshGoogleToken(userId: number): Promise<string | null> {
    const user = await this.userService.findUserByID(userId);

    if (!user.googleRefreshToken) {
      return null;
    }

    try {
      let refreshToken: string;
      try {
        refreshToken = decrypt(user.googleRefreshToken);
      } catch (decryptError: any) {
        // Se não consegue descriptografar o refresh token, não pode renovar
        return null;
      }
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      );

      if (!clientId || !clientSecret) {
        return null;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      await this.userService.updateGoogleTokens(
        userId,
        encrypt(data.access_token),
        user.googleRefreshToken, // Mantém o refresh token
      );

      return data.access_token;
    } catch (error) {
      // Erro silencioso - não loga para não poluir o console
      return null;
    }
  }

  /**
   * Retorna o usuário com todos os tokens (para uso interno)
   */
  async getUserWithTokens(userId: number): Promise<any> {
    const user = await this.userService.findUserByID(userId);
    return user;
  }

  /**
   * Busca as playlists do usuário no Spotify
   */
  async getSpotifyPlaylists(userId: number): Promise<any[]> {
    // Verifica se o usuário está conectado antes de tentar obter o token
    const user = await this.userService.findUserByID(userId);

    if (!user.isSpotifyConnected) {
      console.error(
        '[MediaService] getSpotifyPlaylists - Spotify não está conectado',
      );
      throw new Error('Spotify não está conectado');
    }

    let accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      // Se não tem refresh token, realmente não está conectado
      if (!user.spotifyRefreshToken) {
        throw new Error('Spotify não está conectado');
      }

      // Se tem refresh token mas não conseguiu renovar, pode ser token corrompido
      throw new Error(
        'Não foi possível obter token válido. Por favor, reconecte sua conta do Spotify.',
      );
    }

    try {
      let response = await fetch(
        'https://api.spotify.com/v1/me/playlists?limit=50',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Se o token estiver expirado (401), tenta renovar e refazer a requisição
      if (response.status === 401) {
        const refreshedToken = await this.refreshSpotifyToken(userId);
        if (refreshedToken) {
          accessToken = refreshedToken;
          response = await fetch(
            'https://api.spotify.com/v1/me/playlists?limit=50',
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        if (response.status === 401) {
          throw new Error(
            'Token do Spotify expirado ou inválido. Reconecte sua conta.',
          );
        }

        if (response.status === 403) {
          throw new Error(
            'Permissões insuficientes. Reconecte sua conta do Spotify e autorize todas as permissões.',
          );
        }

        throw new Error(`Erro ao buscar playlists: ${errorMessage}`);
      }

      const data = await response.json();

      if (!data.items) {
        return [];
      }

      // Busca TODAS as playlists salvas/ocultadas do banco (incluindo ocultas para filtrar)
      const savedPlaylists = await this.getSavedPlaylists(
        userId,
        MediaProvider.SPOTIFY,
        true, // includeHidden: true para poder filtrar depois
      );

      // Lista de IDs de playlists ocultas - NUNCA retornar essas
      const hiddenPlaylistIds = savedPlaylists
        .filter((p) => p.isHidden)
        .map((p) => p.externalId);

      // Mapeia playlists da API e FILTRA as ocultas
      const playlists = data.items
        .map((playlist: any) => ({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          image: playlist.images[0]?.url || null,
          tracksCount: playlist.tracks.total,
          owner: playlist.owner.display_name,
          uri: playlist.uri,
        }))
        .filter((playlist: any) => !hiddenPlaylistIds.includes(playlist.id)); // CRÍTICO: Remove ocultas

      // Adiciona playlists importadas que não estão na lista da API (apenas as NÃO ocultas)
      const importedPlaylists = savedPlaylists
        .filter(
          (p) => !p.isHidden && !playlists.find((pl) => pl.id === p.externalId),
        )
        .map((p) => ({
          id: p.externalId,
          name: p.title || 'Playlist Importada',
          description: null,
          image: p.thumbnailUrl || null,
          tracksCount: 0,
          owner: 'Importada',
          uri: `spotify:playlist:${p.externalId}`,
        }));

      return [...playlists, ...importedPlaylists];
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Busca as músicas salvas (liked songs) do usuário no Spotify
   */
  async getSpotifySavedTracks(
    userId: number,
    limit: number = 50,
  ): Promise<any[]> {
    // Verifica se o usuário está conectado antes de tentar obter o token
    const user = await this.userService.findUserByID(userId);
    if (!user.isSpotifyConnected) {
      throw new Error('Spotify não está conectado');
    }

    let accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      // Se não tem refresh token, realmente não está conectado
      if (!user.spotifyRefreshToken) {
        throw new Error('Spotify não está conectado');
      }

      // Se tem refresh token mas não conseguiu renovar, pode ser token corrompido
      throw new Error(
        'Não foi possível obter token válido. Por favor, reconecte sua conta do Spotify.',
      );
    }

    try {
      let response = await fetch(
        `https://api.spotify.com/v1/me/tracks?limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // Se o token estiver expirado (401), tenta renovar e refazer a requisição
      if (response.status === 401) {
        const refreshedToken = await this.refreshSpotifyToken(userId);
        if (refreshedToken) {
          accessToken = refreshedToken;
          response = await fetch(
            `https://api.spotify.com/v1/me/tracks?limit=${limit}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          );
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        if (response.status === 401) {
          throw new Error(
            'Token do Spotify expirado ou inválido. Reconecte sua conta.',
          );
        }

        if (response.status === 403) {
          throw new Error(
            'Permissões insuficientes. Reconecte sua conta do Spotify e autorize todas as permissões.',
          );
        }

        throw new Error(`Erro ao buscar músicas salvas: ${errorMessage}`);
      }

      const data = await response.json();
      return data.items.map((item: any) => ({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists[0]?.name || 'Artista desconhecido',
        album: item.track.album.name,
        image: item.track.album.images[0]?.url || null,
        uri: item.track.uri,
        duration: item.track.duration_ms,
      }));
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Reproduz uma playlist ou música no Spotify usando o Web Playback SDK
   */
  async playSpotifyContent(
    userId: number,
    uri: string,
    deviceId?: string,
  ): Promise<void> {
    const accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      throw new Error('Spotify não está conectado');
    }

    try {
      const url = deviceId
        ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
        : 'https://api.spotify.com/v1/me/player/play';

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context_uri:
            uri.includes('playlist') || uri.includes('album') ? uri : undefined,
          uris: uri.includes('track') ? [uri] : undefined,
        }),
      });

      if (!response.ok && response.status !== 204) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message ||
            `Erro ao reproduzir: ${response.statusText}`,
        );
      }
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Extrai o ID de uma URL do Spotify e converte para URI
   */
  private extractSpotifyPlaylistId(url: string): string | null {
    // Suporta formatos:
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M
    // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
    // https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
    const urlMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      return urlMatch[1];
    }

    const uriMatch = url.match(/spotify:playlist:([a-zA-Z0-9]+)/);
    if (uriMatch) {
      return uriMatch[1];
    }

    return null;
  }

  /**
   * Busca informações de uma playlist do Spotify pelo ID (para preview)
   */
  async getSpotifyPlaylistInfo(
    userId: number,
    playlistId: string,
  ): Promise<{
    id: string;
    name: string;
    description: string;
    image: string | null;
    owner: string;
    tracksCount: number;
    uri: string;
  }> {
    const accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      throw new Error('Spotify não está conectado');
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Erro ao buscar informações da playlist: ${response.statusText}`,
        );
      }

      const playlist = await response.json();
      return {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description || '',
        image: playlist.images[0]?.url || null,
        owner: playlist.owner.display_name || playlist.owner.id,
        tracksCount: playlist.tracks.total,
        uri: playlist.uri,
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Busca os itens (tracks) de uma playlist do Spotify
   */
  async getSpotifyPlaylistTracks(
    userId: number,
    playlistId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{
    items: Array<{
      id: string;
      name: string;
      artist: string;
      album: string;
      image: string | null;
      uri: string;
      duration: number;
    }>;
    total: number;
    limit: number;
    offset: number;
  }> {
    const accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      throw new Error('Spotify não está conectado');
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === 401) {
        const refreshedToken = await this.refreshSpotifyToken(userId);
        if (refreshedToken) {
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}`,
            {
              headers: {
                Authorization: `Bearer ${refreshedToken}`,
              },
            },
          );
          if (!retryResponse.ok) {
            throw new Error(
              `Erro ao buscar tracks da playlist: ${retryResponse.statusText}`,
            );
          }
          const data = await retryResponse.json();
          return {
            items: data.items
              .filter((item: any) => item.track && !item.track.is_local)
              .map((item: any) => ({
                id: item.track.id,
                name: item.track.name,
                artist: item.track.artists[0]?.name || 'Artista desconhecido',
                album: item.track.album.name,
                image: item.track.album.images[0]?.url || null,
                uri: item.track.uri,
                duration: item.track.duration_ms,
              })),
            total: data.total,
            limit: data.limit,
            offset: data.offset,
          };
        }
      }

      if (!response.ok) {
        throw new Error(
          `Erro ao buscar tracks da playlist: ${response.statusText}`,
        );
      }

      const data = await response.json();
      return {
        items: data.items
          .filter((item: any) => item.track && !item.track.is_local)
          .map((item: any) => ({
            id: item.track.id,
            name: item.track.name,
            artist: item.track.artists[0]?.name || 'Artista desconhecido',
            album: item.track.album.name,
            image: item.track.album.images[0]?.url || null,
            uri: item.track.uri,
            duration: item.track.duration_ms,
          })),
        total: data.total,
        limit: data.limit,
        offset: data.offset,
      };
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Define a playlist de foco personalizada do usuário
   */
  async setFocusPlaylist(userId: number, url: string): Promise<void> {
    const playlistId = this.extractSpotifyPlaylistId(url);
    if (!playlistId) {
      throw new Error('URL de playlist inválida');
    }

    // Valida se é uma playlist (não uma música)
    const playlistInfo = await this.getSpotifyPlaylistInfo(userId, playlistId);
    if (!playlistInfo) {
      throw new Error('Playlist não encontrada ou inválida');
    }

    // Remove isFocus de todas as playlists anteriores do usuário
    await this.prisma.savedPlaylist.updateMany({
      where: {
        userId,
        provider: MediaProvider.SPOTIFY,
        isFocus: true,
        deletedAt: null,
      },
      data: { isFocus: false },
    });

    // Cria ou atualiza a playlist com isFocus: true
    await this.savePlaylist(
      userId,
      playlistId,
      MediaProvider.SPOTIFY,
      playlistInfo.name,
      playlistInfo.image || undefined,
      false, // isHidden
      true, // isFocus
    );

    await this.logsService.createLog(
      userId,
      LogActionType.SETTINGS_UPDATE,
      `Playlist de foco definida: ${playlistInfo.name}`,
    );
  }

  /**
   * Remove a playlist de foco personalizada do usuário
   */
  async removeFocusPlaylist(userId: number): Promise<void> {
    await this.userService.findUserByID(userId);

    // Remove isFocus de todas as playlists do usuário
    await this.prisma.savedPlaylist.updateMany({
      where: {
        userId,
        provider: MediaProvider.SPOTIFY,
        isFocus: true,
        deletedAt: null,
      },
      data: { isFocus: false },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.SETTINGS_UPDATE,
      'Playlist de foco removida',
    );
  }

  /**
   * Busca músicas no Spotify usando a API de busca
   */
  async searchSpotify(
    userId: number,
    query: string,
    limit: number = 20,
  ): Promise<
    Array<{
      id: string;
      name: string;
      artist: string;
      album: string;
      image: string | null;
      uri: string;
      duration: number; // em milissegundos
    }>
  > {
    const accessToken = await this.getSpotifyAccessToken(userId);
    if (!accessToken) {
      throw new Error('Spotify não está conectado');
    }

    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === 401) {
        const refreshedToken = await this.refreshSpotifyToken(userId);
        if (refreshedToken) {
          const retryResponse = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
            {
              headers: {
                Authorization: `Bearer ${refreshedToken}`,
              },
            },
          );
          if (!retryResponse.ok) {
            throw new Error(
              `Erro ao buscar no Spotify: ${retryResponse.statusText}`,
            );
          }
          const data = await retryResponse.json();
          return (
            data.tracks?.items?.map((track: any) => ({
              id: track.id,
              name: track.name,
              artist: track.artists[0]?.name || 'Artista desconhecido',
              album: track.album.name,
              image: track.album.images[0]?.url || null,
              uri: track.uri,
              duration: track.duration_ms,
            })) || []
          );
        }
      }

      if (!response.ok) {
        throw new Error(`Erro ao buscar no Spotify: ${response.statusText}`);
      }

      const data = await response.json();
      return (
        data.tracks?.items?.map((track: any) => ({
          id: track.id,
          name: track.name,
          artist: track.artists[0]?.name || 'Artista desconhecido',
          album: track.album.name,
          image: track.album.images[0]?.url || null,
          uri: track.uri,
          duration: track.duration_ms,
        })) || []
      );
    } catch (error: any) {
      throw error;
    }
  }

  async handleBackgroundUpload(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{
    url: string;
    mimeType: string;
    size: number;
    isVideo: boolean;
  }> {
    const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const isVideo = file.mimetype.startsWith('video/');

    await this.logsService.createLog(
      userId,
      LogActionType.SETTINGS_UPDATE,
      `Background updated (${isVideo ? 'video' : 'image'})`,
    );

    return {
      url: dataUrl,
      mimeType: file.mimetype,
      size: file.size,
      isVideo,
    };
  }

  /**
   * Salva ou atualiza uma playlist na tabela SavedPlaylist
   */
  async savePlaylist(
    userId: number,
    externalId: string,
    provider: MediaProvider,
    title?: string,
    thumbnailUrl?: string,
    isHidden: boolean = false,
    isFocus: boolean = false,
  ) {
    return await this.prisma.savedPlaylist.upsert({
      where: {
        userId_externalId_provider: {
          userId,
          externalId,
          provider,
        },
      },
      update: {
        title,
        thumbnailUrl,
        isHidden,
        isFocus,
        updatedAt: new Date(),
      },
      create: {
        userId,
        externalId,
        provider,
        title,
        thumbnailUrl,
        isHidden,
        isFocus,
      },
    });
  }

  /**
   * Marca uma playlist como oculta ou visível
   */
  async togglePlaylistVisibility(
    userId: number,
    externalId: string,
    provider: MediaProvider,
    isHidden: boolean,
  ) {
    return await this.savePlaylist(
      userId,
      externalId,
      provider,
      undefined,
      undefined,
      isHidden,
    );
  }

  /**
   * Busca playlists salvas do usuário por provider
   */
  async getSavedPlaylists(
    userId: number,
    provider: MediaProvider,
    includeHidden: boolean = false,
  ) {
    return await this.prisma.savedPlaylist.findMany({
      where: {
        userId,
        provider,
        deletedAt: null,
        ...(includeHidden ? {} : { isHidden: false }),
      },
    });
  }
}
