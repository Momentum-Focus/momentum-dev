import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly youtubeService: YouTubeService,
    private readonly userService: UserService,
    private readonly logsService: LogsService,
    private readonly planService: PlanService,
    private readonly configService: ConfigService,
  ) {}

  @Get('spotify/login')
  async initiateSpotifyAuth(@Request() req: any, @Res() res: Response) {
    // Constrói a URL de autorização manualmente para garantir show_dialog=true
    const jwtToken = req.query?.jwt as string;
    if (!jwtToken) {
      return res.status(400).json({ message: 'Token JWT é obrigatório' });
    }

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const redirectUri = isProduction
      ? this.configService.get<string>('SPOTIFY_REDIRECT_URI_PROD') ||
        'https://momentum-api.onrender.com/media/spotify/callback'
      : this.configService.get<string>('SPOTIFY_REDIRECT_URI') ||
        'http://127.0.0.1:3000/media/spotify/callback';

    const clientID = this.configService.get<string>('SPOTIFY_CLIENT_ID') || '';

    if (!clientID) {
      return res
        .status(500)
        .json({ message: 'SPOTIFY_CLIENT_ID não configurado' });
    }
    const scopes = [
      'user-read-playback-state',
      'user-modify-playback-state',
      'user-read-currently-playing',
      'streaming',
      'user-read-email',
      'user-read-private',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
    ].join(' ');

    // Constrói a URL de autorização com show_dialog=true para forçar seleção de conta
    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams(
      {
        client_id: clientID,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes,
        state: jwtToken, // Passa o JWT via state
        show_dialog: 'true', // FORÇA a tela de escolha de conta sempre
      },
    ).toString()}`;

    return res.redirect(authUrl);
  }

  @Get('spotify/callback')
  async handleSpotifyCallback(@Request() req: any, @Res() res: Response) {
    this.logger.log('[SPOTIFY CALLBACK] Iniciando callback do Spotify');
    this.logger.log(
      '[SPOTIFY CALLBACK] Query params:',
      JSON.stringify(req.query),
    );

    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const frontendUrl = isProduction
      ? process.env.FRONTEND_URL_PROD || 'https://momentum-rouge.vercel.app'
      : process.env.FRONTEND_URL || 'http://localhost:8080';

    // Função auxiliar para retornar HTML de erro
    const sendErrorHTML = (message: string) => {
      this.logger.error(`[SPOTIFY CALLBACK] Erro: ${message}`);
      return res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Erro - Momentum</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'MEDIA_CONNECT_ERROR', 
        provider: 'spotify',
        error: '${message}',
        success: false
      }, '*');
      setTimeout(() => window.close(), 1000);
    } else {
      setTimeout(() => window.location.href = '${frontendUrl}', 2000);
    }
  </script>
  <p>Erro: ${message}</p>
</body>
</html>`);
    };

    try {
      const code = req.query?.code as string;
      const state = req.query?.state as string;

      this.logger.log('[SPOTIFY CALLBACK] Code recebido:', !!code);
      if (code) {
        this.logger.log(
          '[SPOTIFY CALLBACK] Code (primeiros 20 chars):',
          code.substring(0, 20) + '...',
        );
      }
      this.logger.log('[SPOTIFY CALLBACK] State recebido:', !!state);
      if (state) {
        this.logger.log(
          '[SPOTIFY CALLBACK] State (primeiros 50 chars):',
          state.substring(0, 50) + '...',
        );
      }

      if (!code || !state) {
        this.logger.error('Callback do Spotify sem code ou state', {
          hasCode: !!code,
          hasState: !!state,
          query: req.query,
        });
        return sendErrorHTML('Código de autorização ou state não fornecido');
      }

      // Decodifica o JWT do state para obter o userId
      let userId: number;
      try {
        // Usa jwt.decode que não precisa de secret (apenas decodifica, não valida)
        const decoded = jwt.decode(state) as { sub: number | string } | null;
        if (!decoded || !decoded.sub) {
          throw new Error('Token JWT inválido');
        }
        // Garante que userId seja um número (pode vir como string do JWT)
        userId =
          typeof decoded.sub === 'string'
            ? parseInt(decoded.sub, 10)
            : decoded.sub;
        if (isNaN(userId)) {
          this.logger.error('userId não é um número válido', {
            sub: decoded.sub,
            subType: typeof decoded.sub,
          });
          throw new Error('Token JWT inválido: userId não é um número');
        }
      } catch (error: any) {
        this.logger.error('Erro ao decodificar JWT do state', {
          error: error.message,
          state: state.substring(0, 50) + '...',
        });
        return sendErrorHTML('Token de autenticação inválido');
      }

      this.logger.log('[SPOTIFY CALLBACK] userId decodificado:', userId);
      this.logger.log(
        '[SPOTIFY CALLBACK] Continuando para preparar credenciais...',
      );

      // Troca o código de autorização por tokens
      this.logger.log(
        '[SPOTIFY CALLBACK] Preparando redirectUri e credenciais...',
      );
      const redirectUri = isProduction
        ? this.configService.get<string>('SPOTIFY_REDIRECT_URI_PROD') ||
          'https://momentum-api.onrender.com/media/spotify/callback'
        : this.configService.get<string>('SPOTIFY_REDIRECT_URI') ||
          'http://127.0.0.1:3000/media/spotify/callback';

      this.logger.log('[SPOTIFY CALLBACK] redirectUri:', redirectUri);

      const clientID =
        this.configService.get<string>('SPOTIFY_CLIENT_ID') || '';
      const clientSecret =
        this.configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';

      this.logger.log('[SPOTIFY CALLBACK] Credenciais:', {
        hasClientID: !!clientID,
        hasClientSecret: !!clientSecret,
      });

      if (!clientID || !clientSecret) {
        this.logger.error(
          'SPOTIFY_CLIENT_ID ou SPOTIFY_CLIENT_SECRET não configurado',
        );
        return sendErrorHTML('Configuração do Spotify não encontrada');
      }

      this.logger.log(
        '[SPOTIFY CALLBACK] Fazendo requisição para trocar code por tokens...',
      );

      // Faz a requisição para trocar o code por tokens
      let tokenResponse;
      try {
        tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(`${clientID}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
          }),
        });
        this.logger.log(
          '[SPOTIFY CALLBACK] Requisição de tokens concluída, status:',
          tokenResponse.status,
        );
      } catch (fetchError: any) {
        this.logger.error('[SPOTIFY CALLBACK] Erro na requisição fetch:', {
          error: fetchError.message,
          stack: fetchError.stack,
        });
        return sendErrorHTML(
          `Erro de rede ao obter tokens: ${fetchError.message}`,
        );
      }

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        this.logger.error('Erro ao trocar code por tokens do Spotify', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorData,
        });
        return sendErrorHTML('Erro ao obter tokens do Spotify');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      this.logger.log('[SPOTIFY CALLBACK] Tokens recebidos:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      if (!accessToken || !refreshToken) {
        this.logger.error('Tokens do Spotify não recebidos', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
        });
        return sendErrorHTML('Tokens do Spotify não recebidos');
      }

      // Verifica se o usuário existe
      this.logger.log('[SPOTIFY CALLBACK] Buscando usuário no banco...');
      let user;
      try {
        user = await this.userService.findUserByID(userId);
        this.logger.log('[SPOTIFY CALLBACK] Usuário encontrado:', !!user);
      } catch (error: any) {
        this.logger.error('Erro ao buscar usuário', {
          userId,
          error: error.message,
        });
        return sendErrorHTML('Usuário não encontrado');
      }

      if (!user) {
        this.logger.error('[SPOTIFY CALLBACK] Usuário não encontrado no banco');
        return sendErrorHTML('Usuário não encontrado');
      }

      // Criptografa e salva os tokens - GARANTE que está completo antes de continuar
      this.logger.log('[SPOTIFY CALLBACK] Criptografando tokens...');
      try {
        const encryptedAccessToken = encrypt(accessToken);
        const encryptedRefreshToken = encrypt(refreshToken);
        this.logger.log('[SPOTIFY CALLBACK] Tokens criptografados com sucesso');

        // Captura o tipo de conta (Premium/Free) antes de salvar
        let spotifyProduct: string | null = null;
        try {
          const meResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (meResponse.ok) {
            const meData = await meResponse.json();

            // Tenta múltiplas formas de obter o product
            const rawProduct =
              meData.product ||
              meData.product_type ||
              meData.subscription?.product ||
              meData.subscription?.type ||
              null;

            // Normaliza o product: "premium", "premium_family", "premium_duo" -> "premium"
            // "free", "open" -> mantém como está
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
            } else {
              spotifyProduct = null;
            }

            // Se não encontrou product, tenta novamente após um pequeno delay
            if (!spotifyProduct) {
              await new Promise((resolve) => setTimeout(resolve, 500));
              const retryResponse = await fetch(
                'https://api.spotify.com/v1/me',
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                },
              );
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                spotifyProduct = retryData.product || null;
              }
            }
          }
        } catch (error) {
          // Erro silencioso - não loga para não poluir o console
        }

        // Aguarda completamente a atualização dos tokens
        this.logger.log('[SPOTIFY CALLBACK] Salvando tokens no banco...');
        await this.userService.updateSpotifyTokens(
          userId,
          encryptedAccessToken,
          encryptedRefreshToken,
          spotifyProduct, // Pode ser 'premium', 'free', 'open', ou null
        );
        this.logger.log('[SPOTIFY CALLBACK] Tokens salvos no banco');

        // Verifica se os tokens foram salvos corretamente
        this.logger.log(
          '[SPOTIFY CALLBACK] Verificando salvamento dos tokens...',
        );
        const updatedUser = await this.userService.findUserByID(userId);

        if (
          !updatedUser.isSpotifyConnected ||
          !updatedUser.spotifyAccessToken
        ) {
          this.logger.error(
            '[SPOTIFY CALLBACK] Falha ao verificar salvamento dos tokens',
          );
          throw new Error('Falha ao verificar salvamento dos tokens');
        }
        this.logger.log('[SPOTIFY CALLBACK] Tokens verificados com sucesso');

        // Cria log após confirmar que os tokens foram salvos
        this.logger.log('[SPOTIFY CALLBACK] Criando log de conexão...');
        await this.logsService.createLog(
          userId,
          LogActionType.MEDIA_CONNECT_SPOTIFY,
          'Spotify connected',
        );

        // Delay artificial para garantir que a transação do banco finalizou completamente
        // Isso evita race conditions onde o frontend tenta buscar o token antes dele estar disponível
        this.logger.log(
          '[SPOTIFY CALLBACK] Aguardando 1s para garantir que tudo foi salvo...',
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.logger.log(
          '[SPOTIFY CALLBACK] Delay concluído, preparando resposta HTML...',
        );
      } catch (error: any) {
        this.logger.error('Erro ao salvar tokens do Spotify', {
          userId,
          error: error.message,
          stack: error.stack,
        });
        return sendErrorHTML(`Erro ao salvar tokens: ${error.message}`);
      }

      // Retorna HTML de sucesso - apenas após confirmar que tudo foi salvo e aguardar o delay
      this.logger.log('[SPOTIFY CALLBACK] Enviando HTML de sucesso...');

      res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Conectado - Momentum</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #0F1115;
      color: #FFFFFF;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      text-align: center;
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      max-width: 400px;
      width: 100%;
      animation: fadeIn 0.5s ease-out;
    }
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      margin-bottom: 0.5rem;
      animation: scaleIn 0.4s ease-out 0.1s both;
    }
    @keyframes scaleIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      color: #FFFFFF;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .subtitle {
      font-size: 0.9375rem;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
      margin: 0;
    }
    .loading-dots {
      display: inline-flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      animation: pulse 1.4s ease-in-out infinite;
    }
    .dot:nth-child(2) {
      animation-delay: 0.2s;
    }
    .dot:nth-child(3) {
      animation-delay: 0.4s;
    }
    @keyframes pulse {
      0%, 80%, 100% {
        opacity: 0.4;
        transform: scale(1);
      }
      40% {
        opacity: 1;
        transform: scale(1.2);
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-container">
      <svg viewBox="0 0 24 24" width="64" height="64" fill="#1DB954">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.781-.6 13.5 1.62.42.181.48.779.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
    </div>
    <h1>Conectado com Sucesso!</h1>
    <p class="subtitle">Fechando janela...</p>
    <div class="loading-dots">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>
  </div>
  <script>
    // Envia múltiplas mensagens para garantir que o frontend receba
    // Alguns navegadores podem bloquear a primeira mensagem
    function sendMessage() {
      if (window.opener) {
        try {
          // Novo formato (prioritário)
          window.opener.postMessage({ 
            type: 'MEDIA_CONNECT_SUCCESS', 
            provider: 'spotify',
            success: true,
            timestamp: Date.now()
          }, '*');
          
          // Formato antigo (compatibilidade)
          window.opener.postMessage({ 
            type: 'SPOTIFY_CONNECTED', 
            success: true,
            timestamp: Date.now()
          }, '*');
        } catch (error) {
          // Erro silencioso
        }
      }
    }
    
    // Envia imediatamente
    sendMessage();
    
    // Envia novamente após um pequeno delay (para garantir)
    setTimeout(sendMessage, 100);
    setTimeout(sendMessage, 500);
    
    // Fecha a janela após garantir que as mensagens foram enviadas
    if (window.opener) {
      setTimeout(() => {
        try {
          window.close();
        } catch (error) {
          // Erro silencioso
        }
      }, 1500);
    } else {
      setTimeout(() => {
        window.location.href = '${frontendUrl}';
      }, 2000);
    }
  </script>
</body>
</html>`);
    } catch (error: any) {
      this.logger.error('[SPOTIFY CALLBACK] Erro geral no callback:', {
        error: error.message,
        stack: error.stack,
        user: req.user,
        query: req.query,
      });
      return sendErrorHTML(
        error.message || 'Erro ao processar callback do Spotify',
      );
    }
  }

  @Get('spotify/status')
  @UseGuards(JwtAuthGuard)
  async getSpotifyStatus(@Request() req: any) {
    return await this.mediaService.getSpotifyConnectionStatus(req.user.id);
  }

  @Get('spotify/token')
  @UseGuards(JwtAuthGuard)
  async getSpotifyToken(@Request() req: any) {
    try {
      // Verifica se o usuário tem refresh token antes de tentar obter access token
      const user = await this.mediaService.getUserWithTokens(req.user.id);

      // Se não está conectado, retorna erro
      if (!user.isSpotifyConnected) {
        throw new BadRequestException('Spotify não está conectado');
      }

      // Se tem refresh token, sempre tenta obter o access token (mesmo que falhe antes)
      // Isso garante que nunca retornamos 400 se houver refresh token disponível
      const accessToken = await this.mediaService.getSpotifyAccessToken(
        req.user.id,
      );

      if (!accessToken) {
        // Se ainda tem refresh token, significa que o refresh falhou
        // Mas não retornamos 400, apenas null (o frontend tratará)
        if (user.spotifyRefreshToken) {
          // Tenta uma última vez fazer refresh
          // Se ainda falhar, retorna erro informativo mas não 400
          throw new BadRequestException(
            'Não foi possível renovar o token do Spotify. Por favor, reconecte sua conta.',
          );
        }

        // Se não tem refresh token, realmente não está conectado
        throw new BadRequestException('Spotify não está conectado');
      }

      return { accessToken };
    } catch (error: any) {
      // Se o erro já for uma BadRequestException, propaga
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Erro ao buscar token do Spotify:', {
        userId: req.user.id,
        error: error.message,
      });

      throw new BadRequestException(
        error.message || 'Erro ao buscar token do Spotify',
      );
    }
  }

  @Get('spotify/playlists')
  @UseGuards(JwtAuthGuard)
  async getSpotifyPlaylists(@Request() req: any) {
    try {
      return await this.mediaService.getSpotifyPlaylists(req.user.id);
    } catch (error: any) {
      this.logger.error('Erro ao buscar playlists do Spotify:', {
        userId: req.user.id,
        error: error.message,
      });

      // Detecta erro de tokens corrompidos
      if (error.message?.includes('corrompidos')) {
        throw new BadRequestException(
          'Os tokens do Spotify foram limpos. Por favor, reconecte sua conta.',
        );
      }

      // Mensagem mais específica para 403
      if (
        error.message?.includes('Permissões insuficientes') ||
        error.message?.includes('Forbidden')
      ) {
        throw new BadRequestException(
          'Permissões insuficientes. Por favor, desconecte e reconecte sua conta do Spotify, autorizando todas as permissões solicitadas.',
        );
      }

      throw new BadRequestException(
        error.message || 'Erro ao buscar playlists do Spotify',
      );
    }
  }

  @Get('spotify/saved-tracks')
  @UseGuards(JwtAuthGuard)
  async getSpotifySavedTracks(
    @Request() req: any,
    @Query('limit') limit?: string,
  ) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      return await this.mediaService.getSpotifySavedTracks(
        req.user.id,
        limitNum,
      );
    } catch (error: any) {
      this.logger.error('Erro ao buscar músicas salvas do Spotify:', {
        userId: req.user.id,
        error: error.message,
      });

      // Detecta erro de tokens corrompidos
      if (error.message?.includes('corrompidos')) {
        throw new BadRequestException(
          'Os tokens do Spotify foram limpos. Por favor, reconecte sua conta.',
        );
      }

      // Mensagem mais específica para 403
      if (
        error.message?.includes('Permissões insuficientes') ||
        error.message?.includes('Forbidden')
      ) {
        throw new BadRequestException(
          'Permissões insuficientes. Por favor, desconecte e reconecte sua conta do Spotify, autorizando todas as permissões solicitadas.',
        );
      }

      throw new BadRequestException(
        error.message || 'Erro ao buscar músicas salvas do Spotify',
      );
    }
  }

  @Post('spotify/play')
  @UseGuards(JwtAuthGuard)
  async playSpotifyContent(
    @Request() req: any,
    @Body() body: { uri: string; deviceId?: string },
  ) {
    try {
      await this.mediaService.playSpotifyContent(
        req.user.id,
        body.uri,
        body.deviceId,
      );
      return { success: true, message: 'Reprodução iniciada' };
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Erro ao reproduzir conteúdo do Spotify',
      );
    }
  }

  @Get('spotify/playlist/preview')
  @UseGuards(JwtAuthGuard)
  async previewSpotifyPlaylist(
    @Request() req: any,
    @Query('playlistId') playlistId: string,
  ) {
    if (!playlistId) {
      throw new BadRequestException('ID da playlist é obrigatório');
    }

    try {
      const playlistInfo = await this.mediaService.getSpotifyPlaylistInfo(
        req.user.id,
        playlistId,
      );
      return playlistInfo;
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Erro ao buscar informações da playlist',
      );
    }
  }

  @Get('spotify/playlist/:playlistId/tracks')
  @UseGuards(JwtAuthGuard)
  async getSpotifyPlaylistTracks(
    @Request() req: any,
    @Param('playlistId') playlistId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    if (!playlistId) {
      throw new BadRequestException('ID da playlist é obrigatório');
    }

    try {
      const limitNum = limit ? parseInt(limit, 10) : 100;
      const offsetNum = offset ? parseInt(offset, 10) : 0;
      const tracks = await this.mediaService.getSpotifyPlaylistTracks(
        req.user.id,
        playlistId,
        limitNum,
        offsetNum,
      );
      return tracks;
    } catch (error: any) {
      this.logger.error('Erro ao buscar tracks da playlist:', {
        userId: req.user.id,
        playlistId,
        error: error.message,
      });
      throw new BadRequestException(
        error.message || 'Erro ao buscar tracks da playlist',
      );
    }
  }

  @Post('spotify/playlist')
  @UseGuards(JwtAuthGuard)
  async setFocusPlaylist(@Request() req: any, @Body() body: { url: string }) {
    if (!body.url) {
      throw new BadRequestException('URL da playlist é obrigatória');
    }

    try {
      await this.mediaService.setFocusPlaylist(req.user.id, body.url);
      return { message: 'Playlist de foco definida com sucesso' };
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Erro ao definir playlist de foco',
      );
    }
  }

  @Delete('spotify/playlist')
  @UseGuards(JwtAuthGuard)
  async removeFocusPlaylist(@Request() req: any) {
    try {
      await this.mediaService.removeFocusPlaylist(req.user.id);
      return { message: 'Playlist de foco removida com sucesso' };
    } catch (error: any) {
      throw new BadRequestException(
        error.message || 'Erro ao remover playlist de foco',
      );
    }
  }

  // --- YouTube Music Connection ---
  @Get('google/connect')
  @UseGuards(JwtAuthGuard)
  async connectGoogle(@Request() req: any, @Res() res: Response) {
    const token =
      req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Token não fornecido' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Usuário não autenticado' });
    }

    const state = Buffer.from(JSON.stringify({ token, userId })).toString(
      'base64',
    );
    const redirectUri =
      process.env.NODE_ENV === 'production'
        ? process.env.GOOGLE_YOUTUBE_REDIRECT_URI_PROD ||
          'https://momentum-api.onrender.com/media/google/callback'
        : process.env.GOOGLE_YOUTUBE_REDIRECT_URI ||
          'http://localhost:3000/media/google/callback';

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
    this.logger.log('[GOOGLE CALLBACK] Iniciando callback do Google');
    this.logger.log(
      '[GOOGLE CALLBACK] Query params:',
      JSON.stringify(req.query),
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const frontendUrl = isProduction
      ? process.env.FRONTEND_URL_PROD || 'https://momentum-rouge.vercel.app'
      : process.env.FRONTEND_URL || 'http://localhost:8080';

    // Função auxiliar para retornar HTML de erro
    const sendErrorHTML = (message: string) => {
      this.logger.error(`[GOOGLE CALLBACK] Erro: ${message}`);
      return res.send(`<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <title>Erro - Momentum</title>
</head>
<body>
  <script>
    if (window.opener) {
      window.opener.postMessage({ 
        type: 'MEDIA_CONNECT_ERROR', 
        provider: 'google',
        error: '${message}',
        success: false
      }, '*');
      setTimeout(() => window.close(), 1000);
    } else {
      setTimeout(() => window.location.href = '${frontendUrl}', 2000);
    }
  </script>
  <p>Erro: ${message}</p>
</body>
</html>`);
    };

    if (!code || !state) {
      this.logger.error('[GOOGLE CALLBACK] Código ou state não fornecido');
      return sendErrorHTML('Código ou state não fornecido');
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
        this.logger.error('[GOOGLE CALLBACK] Usuário não autenticado');
        return sendErrorHTML('Usuário não autenticado');
      }

      this.logger.log('[GOOGLE CALLBACK] userId extraído:', userId);

      const redirectUri =
        process.env.NODE_ENV === 'production'
          ? process.env.GOOGLE_YOUTUBE_REDIRECT_URI_PROD ||
            'https://momentum-api.onrender.com/media/google/callback'
          : process.env.GOOGLE_YOUTUBE_REDIRECT_URI ||
            'http://localhost:3000/media/google/callback';

      const clientID = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
      });

      this.logger.log(
        '[GOOGLE CALLBACK] Fazendo requisição para trocar code por tokens...',
      );
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        this.logger.error(
          '[GOOGLE CALLBACK] Erro ao trocar código por token:',
          errorData,
        );
        return sendErrorHTML('Erro ao trocar código por token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token || null;

      this.logger.log('[GOOGLE CALLBACK] Tokens recebidos:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
      });

      this.logger.log('[GOOGLE CALLBACK] Criptografando e salvando tokens...');
      const encryptedAccessToken = encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

      await this.userService.updateGoogleTokens(
        userId,
        encryptedAccessToken,
        encryptedRefreshToken,
      );
      this.logger.log('[GOOGLE CALLBACK] Tokens salvos no banco');

      await this.logsService.createLog(
        userId,
        LogActionType.MEDIA_CONNECT_GOOGLE,
        'YouTube Music connected',
      );
      this.logger.log(
        '[GOOGLE CALLBACK] Log criado, preparando resposta HTML...',
      );

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>YouTube Music Conectado</title>
          </head>
          <body>
            <script>
              // Envia mensagem de sucesso para a janela pai
              if (window.opener) {
                // Novo formato: MEDIA_CONNECT_SUCCESS
                window.opener.postMessage({ 
                  type: 'MEDIA_CONNECT_SUCCESS', 
                  provider: 'google',
                  success: true 
                }, '*');
                
                // Mantém compatibilidade com formato antigo
                window.opener.postMessage({ 
                  type: 'GOOGLE_CONNECTED', 
                  success: true 
                }, '*');
                
                // Fecha a janela do popup
                window.close();
              } else {
                // Se não for um popup, redireciona para a página principal
                window.location.href = '${frontendUrl}';
              }
            </script>
            <p>YouTube Music conectado com sucesso! Esta janela será fechada automaticamente.</p>
          </body>
        </html>
      `);
    } catch (error: any) {
      this.logger.error('[GOOGLE CALLBACK] Erro geral no callback:', {
        error: error.message,
        stack: error.stack,
      });
      return sendErrorHTML(error.message || 'Erro ao processar callback');
    }
  }

  @Get('google/status')
  @UseGuards(JwtAuthGuard)
  async getGoogleStatus(@Request() req: any) {
    return await this.mediaService.getGoogleConnectionStatus(req.user.id);
  }

  @Post('spotify/disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectSpotify(@Request() req: any) {
    await this.userService.disconnectSpotify(req.user.id);
    await this.logsService.createLog(
      req.user.id,
      LogActionType.MEDIA_CONNECT_SPOTIFY, // Temporário até migration ser aplicada
      'Spotify disconnected',
    );
    return { message: 'Spotify desconectado com sucesso' };
  }

  @Post('google/disconnect')
  @UseGuards(JwtAuthGuard)
  async disconnectGoogle(@Request() req: any) {
    try {
      await this.userService.disconnectGoogle(req.user.id);

      // Log da ação de desconexão
      await this.logsService.createLog(
        req.user.id,
        LogActionType.MEDIA_CONNECT_GOOGLE, // Usando o tipo disponível
        'YouTube Music desconectado',
      );

      return { message: 'YouTube Music desconectado com sucesso' };
    } catch (error: any) {
      throw new BadRequestException(
        'Erro ao desconectar YouTube Music. Tente novamente.',
      );
    }
  }

  // --- YouTube Player Endpoints ---
  @Get('youtube/video/:videoId')
  @UseGuards(JwtAuthGuard)
  async getVideoInfo(@Request() req: any) {
    const vidId = req.params.videoId;
    const user = await this.mediaService.getUserWithTokens(req.user.id);

    // Guard Clause: Verifica se tem token primeiro
    if (
      !user.googleAccessToken ||
      (typeof user.googleAccessToken === 'string' &&
        user.googleAccessToken.trim() === '')
    ) {
      if (user.isGoogleConnected) {
        await this.userService.disconnectGoogle(req.user.id);
      }
      return { error: 'YouTube Music não está conectado' };
    }

    let accessToken: string;
    try {
      accessToken = await this.youtubeService.getUserAccessToken(
        user.googleAccessToken,
      );
    } catch (decryptError: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        decryptError.message?.includes('bad decrypt') ||
        decryptError.message?.includes('chave diferente');

      if (isBadDecrypt) {
        this.logger.warn(
          `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens...`,
        );
        try {
          await this.userService.disconnectGoogle(req.user.id);
        } catch (disconnectError: any) {
          this.logger.error(
            'Erro ao limpar tokens corrompidos:',
            disconnectError,
          );
        }
        return {
          error:
            'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
        };
      }

      // Se não for bad decrypt, tenta renovar o token
      const newToken = await this.mediaService.refreshGoogleToken(req.user.id);
      if (newToken) {
        accessToken = newToken;
      } else {
        return {
          error:
            'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
        };
      }
    }

    if (!accessToken) {
      return {
        error: 'Token de acesso do YouTube inválido. Reconecte sua conta.',
      };
    }

    try {
      return await this.youtubeService.getVideoInfo(vidId, accessToken);
    } catch (error: any) {
      this.logger.error('Erro ao buscar informações do vídeo:', {
        userId: req.user.id,
        videoId: vidId,
        error: error.message,
      });
      return { error: error.message || 'Erro ao buscar informações do vídeo.' };
    }
  }

  @Get('youtube/playlists')
  @UseGuards(JwtAuthGuard)
  async getUserPlaylists(@Request() req: any) {
    const includeHidden = req.query.includeHidden === 'true';
    try {
      const user = await this.mediaService.getUserWithTokens(req.user.id);

      // Verifica se tem token primeiro (mais confiável que o flag)
      if (
        !user.googleAccessToken ||
        (typeof user.googleAccessToken === 'string' &&
          user.googleAccessToken.trim() === '')
      ) {
        // Se não tem token mas o flag diz que está conectado, limpa o estado
        if (user.isGoogleConnected) {
          await this.userService.disconnectGoogle(req.user.id);
        }
        throw new BadRequestException(
          'YouTube Music não está conectado. Por favor, conecte sua conta.',
        );
      }

      // Se tem token mas o flag está desatualizado, atualiza o flag
      if (!user.isGoogleConnected && user.googleAccessToken) {
        await this.userService.updateGoogleTokens(
          req.user.id,
          user.googleAccessToken,
          user.googleRefreshToken,
        );
      }

      let accessToken: string;
      try {
        accessToken = await this.youtubeService.getUserAccessToken(
          user.googleAccessToken,
        );
      } catch (decryptError: any) {
        // Detecta erro de "bad decrypt" (chave diferente)
        const isBadDecrypt =
          decryptError.message?.includes('bad decrypt') ||
          decryptError.message?.includes('chave diferente');

        if (isBadDecrypt) {
          // Só loga como warn (não error) para não poluir o console
          this.logger.warn(
            `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens automaticamente...`,
          );
          try {
            await this.userService.disconnectGoogle(req.user.id);
          } catch (disconnectError: any) {
            this.logger.error(
              'Erro ao limpar tokens corrompidos:',
              disconnectError,
            );
          }
          throw new BadRequestException(
            'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
          );
        }

        // Para outros erros de descriptografia, loga como error
        this.logger.error('Erro ao descriptografar token do Google:', {
          userId: req.user.id,
          error: decryptError.message,
          hasToken: !!user.googleAccessToken,
          tokenLength: user.googleAccessToken?.length,
        });

        // Se não for bad decrypt, tenta renovar o token
        const newToken = await this.mediaService.refreshGoogleToken(
          req.user.id,
        );
        if (newToken) {
          // Atualiza o token no banco e tenta novamente
          accessToken = newToken;
        } else {
          throw new BadRequestException(
            'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
          );
        }
      }

      if (!accessToken) {
        throw new BadRequestException(
          'Token de acesso do YouTube inválido. Reconecte sua conta.',
        );
      }

      try {
        // Tenta buscar playlists com retry automático em caso de 401
        let playlists;
        try {
          playlists = await this.youtubeService.getUserPlaylists(accessToken);
        } catch (playlistError: any) {
          // Se for erro 401 (token expirado), tenta refresh e retry
          const is401Error =
            playlistError.response?.status === 401 ||
            playlistError.message?.includes('expirado') ||
            playlistError.message?.includes('401') ||
            playlistError.message?.includes('Token expirado') ||
            playlistError.message?.includes('invalid') ||
            playlistError.message?.includes('Unauthorized');

          if (is401Error) {
            this.logger.warn(
              `Token expirado para usuário ${req.user.id}. Tentando renovar...`,
            );

            const newToken = await this.mediaService.refreshGoogleToken(
              req.user.id,
            );

            if (!newToken) {
              this.logger.error(
                `Não foi possível renovar token para usuário ${req.user.id}`,
              );
              throw new BadRequestException(
                'Token expirado e não foi possível renovar. Por favor, reconecte sua conta do YouTube Music.',
              );
            }

            // Atualiza o accessToken e tenta novamente
            accessToken = newToken;
            this.logger.log(
              `Token renovado com sucesso para usuário ${req.user.id}. Tentando buscar playlists novamente...`,
            );

            try {
              playlists =
                await this.youtubeService.getUserPlaylists(accessToken);
            } catch (retryError: any) {
              // Se ainda der erro após refresh, pode ser problema mais sério
              this.logger.error(
                `Erro ao buscar playlists após refresh para usuário ${req.user.id}:`,
                retryError.message,
              );
              throw new BadRequestException(
                'Erro ao buscar playlists após renovar token. Por favor, reconecte sua conta do YouTube Music.',
              );
            }
          } else {
            throw playlistError;
          }
        }

        // Filtra playlists ocultadas se não incluir hidden
        const user = await this.mediaService.getUserWithTokens(req.user.id);
        const hiddenPlaylists = Array.isArray(user.youtubeHiddenPlaylists)
          ? (user.youtubeHiddenPlaylists as string[])
          : [];

        let filteredPlaylists = playlists;
        if (!includeHidden && hiddenPlaylists.length > 0) {
          filteredPlaylists = playlists.filter(
            (p) => !hiddenPlaylists.includes(p.id),
          );
        }

        // Adiciona playlists importadas que não estão na lista
        const savedPlaylists = Array.isArray(user.youtubeSavedPlaylists)
          ? (user.youtubeSavedPlaylists as string[])
          : [];

        // Busca informações das playlists importadas que não estão na lista
        const importedPlaylists: Array<{
          id: string;
          title: string;
          description: string;
          thumbnail: string;
          itemCount: number;
        }> = [];
        for (const savedId of savedPlaylists) {
          if (!playlists.find((p) => p.id === savedId)) {
            try {
              const playlistInfo = await this.youtubeService.getPlaylistInfo(
                savedId,
                accessToken,
              );
              // Converte para o formato esperado
              importedPlaylists.push({
                id: playlistInfo.id,
                title: playlistInfo.title,
                description: playlistInfo.description || '',
                thumbnail: playlistInfo.thumbnail || '',
                itemCount: playlistInfo.itemCount || 0,
              });
            } catch (error) {
              // Se a playlist não existe mais, ignora silenciosamente
            }
          }
        }

        return [...filteredPlaylists, ...importedPlaylists];
      } catch (playlistError: any) {
        // Se o erro for 404 (Channel not found), retorna array vazio
        if (
          playlistError.response?.status === 404 ||
          playlistError.message?.includes('Channel not found') ||
          playlistError.message?.includes('404')
        ) {
          return []; // Retorna array vazio ao invés de erro
        }

        // Se o erro for 401 (Unauthorized), tenta renovar o token
        if (
          playlistError.response?.status === 401 ||
          playlistError.message?.includes('401') ||
          playlistError.message?.includes('expirado') ||
          playlistError.message?.includes('invalid')
        ) {
          const newToken = await this.mediaService.refreshGoogleToken(
            req.user.id,
          );

          if (newToken) {
            // Tenta novamente com o novo token
            const playlists =
              await this.youtubeService.getUserPlaylists(newToken);
            return playlists;
          }
        }

        // Se não conseguiu renovar ou o erro não é 401/404, propaga o erro
        throw playlistError;
      }
    } catch (error: any) {
      // Se já é um BadRequestException, apenas propaga (não loga como erro crítico)
      if (error instanceof BadRequestException) {
        // Só loga se não for o erro esperado de "não conectado" ou "channel not found"
        throw error;
      }

      throw new BadRequestException(
        error.message || 'Erro ao buscar playlists do YouTube Music',
      );
    }
  }

  @Get('youtube/playlist/:playlistId')
  @UseGuards(JwtAuthGuard)
  async getPlaylistItems(@Request() req: any) {
    const playlistId = req.params.playlistId;
    const user = await this.mediaService.getUserWithTokens(req.user.id);

    // Guard Clause: Verifica se tem token primeiro
    if (
      !user.googleAccessToken ||
      (typeof user.googleAccessToken === 'string' &&
        user.googleAccessToken.trim() === '')
    ) {
      if (user.isGoogleConnected) {
        await this.userService.disconnectGoogle(req.user.id);
      }
      throw new BadRequestException(
        'YouTube Music não está conectado. Por favor, conecte sua conta.',
      );
    }

    let accessToken: string;
    try {
      accessToken = await this.youtubeService.getUserAccessToken(
        user.googleAccessToken,
      );
    } catch (decryptError: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        decryptError.message?.includes('bad decrypt') ||
        decryptError.message?.includes('chave diferente');

      if (isBadDecrypt) {
        // Só loga como warn (não error) para não poluir o console
        this.logger.warn(
          `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens automaticamente...`,
        );
        try {
          await this.userService.disconnectGoogle(req.user.id);
        } catch (disconnectError: any) {
          this.logger.error(
            'Erro ao limpar tokens corrompidos:',
            disconnectError,
          );
        }
        throw new BadRequestException(
          'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
        );
      }

      // Para outros erros de descriptografia, loga como error
      this.logger.error('Erro ao descriptografar token do Google:', {
        userId: req.user.id,
        error: decryptError.message,
        hasToken: !!user.googleAccessToken,
        tokenLength: user.googleAccessToken?.length,
      });

      // Se não for bad decrypt, tenta renovar o token
      const newToken = await this.mediaService.refreshGoogleToken(req.user.id);
      if (newToken) {
        accessToken = newToken;
        this.logger.log(
          `Token renovado com sucesso para usuário ${req.user.id}.`,
        );
      } else {
        throw new BadRequestException(
          'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
        );
      }
    }

    if (!accessToken) {
      throw new BadRequestException(
        'Token de acesso do YouTube inválido. Reconecte sua conta.',
      );
    }

    try {
      return await this.youtubeService.getPlaylistItems(
        playlistId,
        accessToken,
      );
    } catch (error: any) {
      this.logger.error('Erro ao buscar itens da playlist:', {
        userId: req.user.id,
        playlistId,
        error: error.message,
      });
      throw new BadRequestException(
        error.message || 'Erro ao buscar músicas da playlist.',
      );
    }
  }

  @Get('youtube/playlist/:playlistId/items')
  @UseGuards(JwtAuthGuard)
  async getPlaylistItemsDetailed(@Request() req: any) {
    const playlistId = req.params.playlistId;
    const user = await this.mediaService.getUserWithTokens(req.user.id);

    // Guard Clause: Verifica se tem token primeiro
    if (
      !user.googleAccessToken ||
      (typeof user.googleAccessToken === 'string' &&
        user.googleAccessToken.trim() === '')
    ) {
      if (user.isGoogleConnected) {
        await this.userService.disconnectGoogle(req.user.id);
      }
      throw new BadRequestException(
        'YouTube Music não está conectado. Por favor, conecte sua conta.',
      );
    }

    // Sincroniza flag se necessário
    if (!user.isGoogleConnected && user.googleAccessToken) {
      await this.userService.updateGoogleTokens(
        req.user.id,
        user.googleAccessToken,
        user.googleRefreshToken,
      );
    }

    let accessToken: string;
    try {
      accessToken = await this.youtubeService.getUserAccessToken(
        user.googleAccessToken,
      );
    } catch (decryptError: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        decryptError.message?.includes('bad decrypt') ||
        decryptError.message?.includes('chave diferente');

      if (isBadDecrypt) {
        // Só loga como warn (não error) para não poluir o console
        this.logger.warn(
          `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens automaticamente...`,
        );
        try {
          await this.userService.disconnectGoogle(req.user.id);
        } catch (disconnectError: any) {
          this.logger.error(
            'Erro ao limpar tokens corrompidos:',
            disconnectError,
          );
        }
        throw new BadRequestException(
          'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
        );
      }

      // Para outros erros de descriptografia, loga como error
      this.logger.error('Erro ao descriptografar token do Google:', {
        userId: req.user.id,
        error: decryptError.message,
        hasToken: !!user.googleAccessToken,
        tokenLength: user.googleAccessToken?.length,
      });

      // Se não for bad decrypt, tenta renovar o token
      const newToken = await this.mediaService.refreshGoogleToken(req.user.id);
      if (newToken) {
        accessToken = newToken;
        this.logger.log(
          `Token renovado com sucesso para usuário ${req.user.id}.`,
        );
      } else {
        throw new BadRequestException(
          'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
        );
      }
    }

    if (!accessToken) {
      throw new BadRequestException(
        'Token de acesso do YouTube inválido. Reconecte sua conta.',
      );
    }

    try {
      // Busca todos os itens da playlist (pode precisar de paginação)
      let items;
      try {
        items = await this.youtubeService.getPlaylistItems(
          playlistId,
          accessToken,
          50,
        );
      } catch (playlistItemsError: any) {
        // Se for erro 401 (token expirado), tenta refresh e retry
        const is401Error =
          playlistItemsError.response?.status === 401 ||
          playlistItemsError.message?.includes('expirado') ||
          playlistItemsError.message?.includes('401') ||
          playlistItemsError.message?.includes('Token expirado') ||
          playlistItemsError.message?.includes('invalid') ||
          playlistItemsError.message?.includes('Unauthorized');

        if (is401Error) {
          this.logger.warn(
            `Token expirado ao buscar itens da playlist para usuário ${req.user.id}. Tentando renovar...`,
          );

          const newToken = await this.mediaService.refreshGoogleToken(
            req.user.id,
          );

          if (!newToken) {
            this.logger.error(
              `Não foi possível renovar token para usuário ${req.user.id}`,
            );
            throw new BadRequestException(
              'Token expirado e não foi possível renovar. Por favor, reconecte sua conta do YouTube Music.',
            );
          }

          // Atualiza o accessToken e tenta novamente
          accessToken = newToken;
          this.logger.log(
            `Token renovado com sucesso para usuário ${req.user.id}. Tentando buscar itens da playlist novamente...`,
          );

          try {
            items = await this.youtubeService.getPlaylistItems(
              playlistId,
              accessToken,
              50,
            );
          } catch (retryError: any) {
            this.logger.error(
              `Erro ao buscar itens da playlist após refresh para usuário ${req.user.id}:`,
              retryError.message,
            );
            throw new BadRequestException(
              'Erro ao buscar músicas da playlist após renovar token. Por favor, reconecte sua conta do YouTube Music.',
            );
          }
        } else {
          throw playlistItemsError;
        }
      }

      return {
        playlistId,
        items: items || [],
        total: items?.length || 0,
      };
    } catch (error: any) {
      // Se já é um BadRequestException, apenas propaga
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error('Erro ao buscar itens da playlist:', {
        userId: req.user.id,
        playlistId,
        error: error.message,
        statusCode: error.response?.status,
      });

      const userMessage =
        error.message?.includes('não encontrada') ||
        error.message?.includes('not found')
          ? 'Playlist não encontrada ou não acessível.'
          : 'Erro ao buscar músicas da playlist. Tente novamente.';

      throw new BadRequestException(userMessage);
    }
  }

  @Post('youtube/playlist/import')
  @UseGuards(JwtAuthGuard)
  async importPlaylist(@Request() req: any, @Body() body: { url: string }) {
    const { url } = body;
    if (!url) {
      throw new BadRequestException('URL da playlist é obrigatória');
    }

    // Extrai o ID da playlist da URL
    const playlistId = this.extractPlaylistIdFromUrl(url);
    if (!playlistId) {
      throw new BadRequestException('URL de playlist inválida');
    }

    const user = await this.mediaService.getUserWithTokens(req.user.id);

    // Guard Clause: Verifica se tem token primeiro
    if (
      !user.googleAccessToken ||
      (typeof user.googleAccessToken === 'string' &&
        user.googleAccessToken.trim() === '')
    ) {
      if (user.isGoogleConnected) {
        await this.userService.disconnectGoogle(req.user.id);
      }
      throw new BadRequestException(
        'YouTube Music não está conectado. Por favor, conecte sua conta.',
      );
    }

    // Verifica se a playlist existe na API
    let accessToken: string;
    try {
      accessToken = await this.youtubeService.getUserAccessToken(
        user.googleAccessToken,
      );
    } catch (decryptError: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        decryptError.message?.includes('bad decrypt') ||
        decryptError.message?.includes('chave diferente');

      if (isBadDecrypt) {
        // Só loga como warn (não error) para não poluir o console
        this.logger.warn(
          `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens automaticamente...`,
        );
        try {
          await this.userService.disconnectGoogle(req.user.id);
        } catch (disconnectError: any) {
          this.logger.error(
            'Erro ao limpar tokens corrompidos:',
            disconnectError,
          );
        }
        throw new BadRequestException(
          'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
        );
      }

      // Para outros erros de descriptografia, loga como error
      this.logger.error('Erro ao descriptografar token do Google:', {
        userId: req.user.id,
        error: decryptError.message,
        hasToken: !!user.googleAccessToken,
        tokenLength: user.googleAccessToken?.length,
      });

      // Se não for bad decrypt, tenta renovar o token
      const newToken = await this.mediaService.refreshGoogleToken(req.user.id);
      if (newToken) {
        accessToken = newToken;
        this.logger.log(
          `Token renovado com sucesso para usuário ${req.user.id}.`,
        );
      } else {
        throw new BadRequestException(
          'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
        );
      }
    }

    if (!accessToken) {
      throw new BadRequestException(
        'Token de acesso do YouTube inválido. Reconecte sua conta.',
      );
    }

    try {
      // Busca informações da playlist para validar
      const playlistInfo = await this.youtubeService.getPlaylistInfo(
        playlistId,
        accessToken,
      );

      // Adiciona à lista de playlists salvas do usuário
      const savedPlaylists = Array.isArray(user.youtubeSavedPlaylists)
        ? (user.youtubeSavedPlaylists as string[])
        : [];
      if (!savedPlaylists.includes(playlistId)) {
        savedPlaylists.push(playlistId);
        await this.userService.updateYouTubePlaylists(
          req.user.id,
          savedPlaylists,
        );
      }

      return {
        message: 'Playlist importada com sucesso',
        playlist: playlistInfo,
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Erro ao importar playlist: ${error.message}`,
      );
    }
  }

  @Post('youtube/playlist/:playlistId/hide')
  @UseGuards(JwtAuthGuard)
  async hidePlaylist(@Request() req: any) {
    const playlistId = req.params.playlistId;
    const user = await this.mediaService.getUserWithTokens(req.user.id);

    const hiddenPlaylists = Array.isArray(user.youtubeHiddenPlaylists)
      ? (user.youtubeHiddenPlaylists as string[])
      : [];
    if (!hiddenPlaylists.includes(playlistId)) {
      hiddenPlaylists.push(playlistId);
      await this.userService.updateYouTubePlaylists(
        req.user.id,
        undefined,
        hiddenPlaylists,
      );
    }

    return { message: 'Playlist ocultada com sucesso' };
  }

  private extractPlaylistIdFromUrl(url: string): string | null {
    const patterns = [
      /[?&]list=([a-zA-Z0-9_-]+)/,
      /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
      /youtu\.be\/.*[?&]list=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  @Post('youtube/play')
  @UseGuards(JwtAuthGuard)
  async playYouTube(@Request() req: any, @Body() body: { videoId: string }) {
    // Nota: A API do YouTube não permite controle direto de reprodução
    // Este endpoint pode retornar informações do vídeo ou um URL para embed
    const user = await this.mediaService.getUserWithTokens(req.user.id);

    // Guard Clause: Verifica se tem token primeiro
    if (
      !user.googleAccessToken ||
      (typeof user.googleAccessToken === 'string' &&
        user.googleAccessToken.trim() === '')
    ) {
      if (user.isGoogleConnected) {
        await this.userService.disconnectGoogle(req.user.id);
      }
      return { error: 'YouTube Music não está conectado' };
    }

    let accessToken: string;
    try {
      accessToken = await this.youtubeService.getUserAccessToken(
        user.googleAccessToken,
      );
    } catch (decryptError: any) {
      // Detecta erro de "bad decrypt" (chave diferente)
      const isBadDecrypt =
        decryptError.message?.includes('bad decrypt') ||
        decryptError.message?.includes('chave diferente');

      if (isBadDecrypt) {
        this.logger.warn(
          `Token criptografado com chave diferente para usuário ${req.user.id}. Limpando tokens...`,
        );
        try {
          await this.userService.disconnectGoogle(req.user.id);
        } catch (disconnectError: any) {
          this.logger.error(
            'Erro ao limpar tokens corrompidos:',
            disconnectError,
          );
        }
        return {
          error:
            'Os tokens do YouTube Music estão corrompidos. Por favor, reconecte sua conta.',
        };
      }

      // Se não for bad decrypt, tenta renovar o token
      const newToken = await this.mediaService.refreshGoogleToken(req.user.id);
      if (newToken) {
        accessToken = newToken;
      } else {
        return {
          error:
            'Erro ao acessar token do YouTube. Reconecte sua conta do YouTube Music.',
        };
      }
    }

    if (!accessToken) {
      return {
        error: 'Token de acesso do YouTube inválido. Reconecte sua conta.',
      };
    }

    try {
      const videoInfo = await this.youtubeService.getVideoInfo(
        body.videoId,
        accessToken,
      );

      return {
        message: 'Vídeo pronto para reprodução',
        video: videoInfo,
        embedUrl: `https://www.youtube.com/embed/${body.videoId}`,
      };
    } catch (error: any) {
      this.logger.error('Erro ao buscar informações do vídeo:', {
        userId: req.user.id,
        videoId: body.videoId,
        error: error.message,
      });
      return {
        error: error.message || 'Erro ao buscar informações do vídeo.',
      };
    }
  }

  @Get('spotify/search')
  @UseGuards(JwtAuthGuard)
  async searchSpotify(@Request() req: any, @Query('q') query: string) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query de busca é obrigatória');
    }

    try {
      const results = await this.mediaService.searchSpotify(
        req.user.id,
        query,
        20,
      );
      return results;
    } catch (error: any) {
      this.logger.error('Erro ao buscar no Spotify:', {
        userId: req.user.id,
        query,
        error: error.message,
      });

      // Verifica se é erro de token
      if (error.message?.includes('não está conectado')) {
        throw new BadRequestException(
          'Spotify não está conectado. Por favor, conecte sua conta.',
        );
      }

      throw new BadRequestException(
        error.message || 'Erro ao buscar no Spotify',
      );
    }
  }

  @Get('youtube/search')
  @UseGuards(JwtAuthGuard)
  async searchYouTube(@Request() req: any, @Query('q') query: string) {
    if (!query || query.trim() === '') {
      throw new BadRequestException('Query de busca é obrigatória');
    }

    try {
      const results = await this.youtubeService.search(query, 20, true); // musicOnly = true
      return results;
    } catch (error: any) {
      this.logger.error('Erro ao buscar no YouTube:', {
        userId: req.user.id,
        query,
        error: error.message,
      });

      throw new BadRequestException(
        error.message || 'Erro ao buscar no YouTube',
      );
    }
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
