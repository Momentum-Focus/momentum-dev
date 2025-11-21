import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { decrypt } from './helpers/encryption.helper';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';
import type { Express } from 'express';

@Injectable()
export class MediaService {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private logsService: LogsService,
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
}
