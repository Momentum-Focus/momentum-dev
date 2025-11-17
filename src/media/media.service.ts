import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { decrypt } from './helpers/encryption.helper';

@Injectable()
export class MediaService {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {}

  /**
   * Retorna o status de conexão do Spotify para um usuário
   */
  async getSpotifyConnectionStatus(userId: number): Promise<{
    isConnected: boolean;
  }> {
    const user = await this.userService.findUserByID(userId);
    return {
      isConnected: user.isSpotifyConnected || false,
    };
  }

  /**
   * Descriptografa e retorna o access token do Spotify para um usuário
   */
  async getSpotifyAccessToken(userId: number): Promise<string | null> {
    const user = await this.userService.findUserByID(userId);

    if (!user.isSpotifyConnected || !user.spotifyAccessToken) {
      return null;
    }

    try {
      return decrypt(user.spotifyAccessToken);
    } catch (error) {
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
   * Retorna o usuário com todos os tokens (para uso interno)
   */
  async getUserWithTokens(userId: number): Promise<any> {
    const user = await this.userService.findUserByID(userId);
    return user;
  }
}
