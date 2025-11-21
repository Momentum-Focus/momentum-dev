import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Express, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { MediaService } from './media.service';
import { YouTubeService } from './youtube.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { UserService } from 'src/user/user.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';
import { encrypt } from './helpers/encryption.helper';
import * as jwt from 'jsonwebtoken';
import { FileInterceptor } from '@nestjs/platform-express';
import { PlanService } from 'src/plan/plan.service';

@Controller('media')
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly youtubeService: YouTubeService,
    private readonly userService: UserService,
    private readonly logsService: LogsService,
    private readonly planService: PlanService,
  ) {}

  @Get('spotify/login')
  @UseGuards(JwtAuthGuard, AuthGuard('spotify'))
  async initiateSpotifyAuth() {
    // O handler fica vazio, pois os guards fazem todo o trabalho de redirecionamento
    // JwtAuthGuard valida o token JWT (do header ou query) e popula req.user
    // AuthGuard('spotify') redireciona para o Spotify
  }

  @Get('spotify/callback')
  @UseGuards(AuthGuard('spotify'))
  async handleSpotifyCallback(@Res() res: Response) {
    // Após a autenticação bem-sucedida, a SpotifyStrategy já salvou os tokens
    // Retorna HTML simples que fecha a janela do popup
    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? process.env.FRONTEND_URL_PROD || 'https://momentum-rouge.vercel.app'
      : process.env.FRONTEND_URL || 'http://localhost:8080';

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Conectado</title>
        </head>
        <body>
          <script>
            // Fecha a janela do popup
            if (window.opener) {
              // Notifica o window opener sobre o sucesso
              window.opener.postMessage({ type: 'SPOTIFY_CONNECTED', success: true }, '${frontendUrl}');
              window.close();
            } else {
              // Se não for um popup, redireciona para a página principal
              window.location.href = '${frontendUrl}';
            }
          </script>
          <p>Spotify conectado com sucesso! Esta janela será fechada automaticamente.</p>
        </body>
      </html>
    `);
  }

  @Get('spotify/status')
  @UseGuards(JwtAuthGuard)
  async getSpotifyStatus(@Request() req: any) {
    return await this.mediaService.getSpotifyConnectionStatus(req.user.id);
  }

  // --- YouTube Music Connection ---
  @Get('google/connect')
  @UseGuards(JwtAuthGuard)
  async connectGoogle(@Request() req: any, @Res() res: Response) {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const state = Buffer.from(JSON.stringify({ token, userId })).toString('base64');
    const redirectUri = process.env.NODE_ENV === 'production'
      ? process.env.GOOGLE_YOUTUBE_REDIRECT_URI_PROD || 'https://momentum-api.onrender.com/media/google/callback'
      : process.env.GOOGLE_YOUTUBE_REDIRECT_URI || 'http://localhost:3000/media/google/callback';

    const clientID = process.env.GOOGLE_CLIENT_ID;
    const scope = 'https://www.googleapis.com/auth/youtube';
    const responseType = 'code';
    const redirectURL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}&access_type=offline&prompt=consent`;

    return res.redirect(redirectURL);
  }

  @Get('google/callback')
  async connectGoogleCallback(
    @Request() req: any,
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    if (!code || !state) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Código ou state não fornecido',
      });
    }

    try {
      const stateData = JSON.parse(
        Buffer.from(decodeURIComponent(state), 'base64').toString(),
      );

      let userId: number | null = null;

      if (stateData.userId) {
        userId = stateData.userId;
      }

      if (!userId && stateData.token) {
        const secret = process.env.JWT_SECRET;
        if (secret && stateData.token) {
          const decoded = jwt.verify(stateData.token, secret) as unknown as {
            sub: number;
          };
          if (decoded && decoded.sub) {
            userId = decoded.sub;
          }
        }
      }

      if (!userId) {
        return res.status(401).json({
          statusCode: 401,
          message: 'Usuário não autenticado',
        });
      }

      const redirectUri = process.env.NODE_ENV === 'production'
        ? process.env.GOOGLE_YOUTUBE_REDIRECT_URI_PROD ||
          'https://momentum-api.onrender.com/media/google/callback'
        : process.env.GOOGLE_YOUTUBE_REDIRECT_URI ||
          'http://localhost:3000/media/google/callback';

      const clientID = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code: code,
            client_id: clientID || '',
            client_secret: clientSecret || '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        return res.status(500).json({
          statusCode: 500,
          message: 'Erro ao trocar código por token',
          error: errorData,
        });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;

      const encryptedAccessToken = encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

      await this.userService.updateGoogleTokens(
        userId,
        encryptedAccessToken,
        encryptedRefreshToken,
      );

      await this.logsService.createLog(
        userId,
        LogActionType.MEDIA_CONNECT_GOOGLE,
        'YouTube Music connected',
      );

      const isProduction = process.env.NODE_ENV === 'production';
      const frontendUrl = isProduction
        ? process.env.FRONTEND_URL_PROD || 'https://momentum-rouge.vercel.app'
        : process.env.FRONTEND_URL || 'http://localhost:8080';

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>YouTube Music Conectado</title>
          </head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_CONNECTED', success: true }, '${frontendUrl}');
                window.close();
              } else {
                window.location.href = '${frontendUrl}';
              }
            </script>
            <p>YouTube Music conectado com sucesso! Esta janela será fechada automaticamente.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      return res.status(500).json({
        statusCode: 500,
        message: error.message || 'Erro ao processar callback',
      });
    }
  }

  @Get('google/status')
  @UseGuards(JwtAuthGuard)
  async getGoogleStatus(@Request() req: any) {
    return await this.mediaService.getGoogleConnectionStatus(req.user.id);
  }

  // --- YouTube Player Endpoints ---
  @Get('youtube/search')
  @UseGuards(JwtAuthGuard)
  async searchYouTube(@Query('q') query: string, @Query('maxResults') maxResults?: string) {
    if (!query) {
      return { error: 'Query parameter "q" is required' };
    }
    const max = maxResults ? parseInt(maxResults, 10) : 10;
    return await this.youtubeService.search(query, max);
  }

  @Get('youtube/video/:videoId')
  @UseGuards(JwtAuthGuard)
  async getVideoInfo(@Request() req: any) {
    const vidId = req.params.videoId;
    const user = await this.mediaService.getUserWithTokens(req.user.id);
    if (!user.isGoogleConnected || !user.googleAccessToken) {
      return { error: 'YouTube Music não está conectado' };
    }

    const accessToken = await this.youtubeService.getUserAccessToken(
      user.googleAccessToken,
    );
    return await this.youtubeService.getVideoInfo(vidId, accessToken);
  }

  @Get('youtube/playlists')
  @UseGuards(JwtAuthGuard)
  async getUserPlaylists(@Request() req: any) {
    const user = await this.mediaService.getUserWithTokens(req.user.id);
    if (!user.isGoogleConnected || !user.googleAccessToken) {
      return { error: 'YouTube Music não está conectado' };
    }

    const accessToken = await this.youtubeService.getUserAccessToken(
      user.googleAccessToken,
    );
    return await this.youtubeService.getUserPlaylists(accessToken);
  }

  @Post('youtube/play')
  @UseGuards(JwtAuthGuard)
  async playYouTube(@Request() req: any, @Body() body: { videoId: string }) {
    // Nota: A API do YouTube não permite controle direto de reprodução
    // Este endpoint pode retornar informações do vídeo ou um URL para embed
    const user = await this.mediaService.getUserWithTokens(req.user.id);
    if (!user.isGoogleConnected || !user.googleAccessToken) {
      return { error: 'YouTube Music não está conectado' };
    }

    const accessToken = await this.youtubeService.getUserAccessToken(
      user.googleAccessToken,
    );
    const videoInfo = await this.youtubeService.getVideoInfo(
      body.videoId,
      accessToken,
    );

    return {
      message: 'Vídeo pronto para reprodução',
      video: videoInfo,
      embedUrl: `https://www.youtube.com/embed/${body.videoId}`,
    };
  }

  @Post('background/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackground(
    @Request() req: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo é obrigatório.');
    }

    const isVideo = file.mimetype.startsWith('video/');
    if (isVideo) {
      const hasFeature = await this.planService.userHasFeature(
        req.user.id,
        'VIDEO_BACKGROUND',
      );

      if (!hasFeature) {
        throw new ForbiddenException(
          'Upgrade para o Momentum Pro para usar fundos em vídeo.',
        );
      }
    }

    return await this.mediaService.handleBackgroundUpload(req.user.id, file);
  }
}
