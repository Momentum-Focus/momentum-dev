import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as SpotifyStrategy } from 'passport-spotify';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';
import { encrypt } from '../helpers/encryption.helper';

@Injectable()
export class SpotifyOAuthStrategy extends PassportStrategy(
  SpotifyStrategy,
  'spotify',
) {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
    private logsService: LogsService,
    private jwtService: JwtService,
  ) {
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUri = isProduction
      ? configService.get<string>('SPOTIFY_REDIRECT_URI_PROD') ||
        'https://momentum-api.onrender.com/media/spotify/callback'
      : configService.get<string>('SPOTIFY_REDIRECT_URI') ||
        'http://127.0.0.1:3000/media/spotify/callback';

    const clientID = configService.get<string>('SPOTIFY_CLIENT_ID') || '';
    const clientSecret =
      configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';

    if (!clientID || !clientSecret) {
      throw new Error(
        'SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET devem estar configurados no .env',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: redirectUri,
      passReqToCallback: true,
      showDialog: true, // Força a tela de escolha de conta sempre
      scope: [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'streaming',
        'user-read-email',
        'user-read-private',
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
      ],
    });
  }

  authenticate(req: any, options?: any): void {
    // Recupera o token JWT do query parameter
    const jwtToken = req.query?.jwt as string;

    // Força sempre mostrar a tela de escolha de conta
    options = options || {};
    options.showDialog = true;

    // Adiciona show_dialog como parâmetro na URL de autorização
    if (!options.authorizationParams) {
      options.authorizationParams = {};
    }
    options.authorizationParams.show_dialog = 'true';

    if (jwtToken) {
      // Passa o token JWT através do state para o callback
      options.state = jwtToken;
    }

    super.authenticate(req, options);
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    try {
      console.log('[SpotifyStrategy] Callback do Spotify recebido.');
      console.log('[SpotifyStrategy] Tokens recebidos:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length || 0,
        refreshTokenLength: refreshToken?.length || 0,
      });

      // Recupera o token JWT do state (passado via OAuth flow)
      const jwtToken = req.query?.state as string;

      if (!jwtToken) {
        console.error('[SpotifyStrategy] Token JWT não fornecido no state');
        throw new UnauthorizedException('Token JWT não fornecido');
      }

      console.log('[SpotifyStrategy] Decodificando State (Token JWT)...');

      // Decodifica o token JWT para obter o userId
      let userId: number;
      try {
        const decoded = this.jwtService.decode(jwtToken) as {
          sub: number | string;
        };
        if (!decoded || !decoded.sub) {
          console.error('[SpotifyStrategy] Token JWT inválido ou sem sub');
          throw new UnauthorizedException('Token JWT inválido');
        }
        // Garante que userId seja um número (pode vir como string do JWT)
        userId =
          typeof decoded.sub === 'string'
            ? parseInt(decoded.sub, 10)
            : decoded.sub;
        if (isNaN(userId)) {
          console.error(
            '[SpotifyStrategy] userId não é um número válido:',
            decoded.sub,
          );
          throw new UnauthorizedException(
            'Token JWT inválido: userId não é um número',
          );
        }
        console.log(
          '[SpotifyStrategy] ID do Usuário extraído do JWT:',
          userId,
          'Tipo:',
          typeof userId,
        );
      } catch (error) {
        console.error(
          '[SpotifyStrategy] Erro ao decodificar token JWT:',
          error,
        );
        throw new UnauthorizedException('Erro ao decodificar token JWT');
      }

      // Verifica se o usuário existe
      let user;
      try {
        console.log(
          '[SpotifyStrategy] Buscando usuário no banco com ID:',
          userId,
        );
        user = await this.userService.findUserByID(userId);
        console.log('[SpotifyStrategy] Usuário encontrado:', {
          id: user.id,
          email: user.email,
          isSpotifyConnected: user.isSpotifyConnected,
        });
      } catch (error: any) {
        console.error(
          '[SpotifyStrategy] Erro ao buscar usuário:',
          error.message,
        );
        throw new UnauthorizedException(
          `Erro ao buscar usuário: ${error.message || 'Usuário não encontrado'}`,
        );
      }

      if (!user) {
        console.error('[SpotifyStrategy] Usuário não encontrado após busca');
        throw new UnauthorizedException('Usuário não encontrado');
      }

      // Captura o tipo de conta (Premium/Free) fazendo uma chamada a /v1/me
      let spotifyProduct: string | null = null;
      try {
        console.log(
          '[SpotifyStrategy] Buscando tipo de conta (Premium/Free)...',
        );
        const meResponse = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (meResponse.ok) {
          const meData = await meResponse.json();
          spotifyProduct = meData.product || null; // 'premium', 'free', ou 'open'
          console.log(
            '[SpotifyStrategy] Tipo de conta detectado:',
            spotifyProduct,
          );
        } else {
          console.warn(
            '[SpotifyStrategy] Não foi possível obter tipo de conta:',
            meResponse.status,
          );
        }
      } catch (error) {
        // Não falha a conexão se não conseguir obter o product
        console.warn(
          '[SpotifyStrategy] Erro ao obter tipo de conta do Spotify:',
          error,
        );
      }

      // Criptografa os tokens antes de salvar
      console.log('[SpotifyStrategy] Criptografando tokens...');
      const encryptedAccessToken = encrypt(accessToken);
      const encryptedRefreshToken = encrypt(refreshToken);
      console.log('[SpotifyStrategy] Tokens criptografados:', {
        encryptedAccessTokenLength: encryptedAccessToken.length,
        encryptedRefreshTokenLength: encryptedRefreshToken.length,
      });

      try {
        console.log(
          '[SpotifyStrategy] Tentando salvar tokens Spotify para o usuário ID:',
          userId,
        );
        console.log('[SpotifyStrategy] Dados a serem salvos:', {
          userId,
          userIdType: typeof userId,
          hasEncryptedAccessToken: !!encryptedAccessToken,
          hasEncryptedRefreshToken: !!encryptedRefreshToken,
          spotifyProduct,
        });

        await this.userService.updateSpotifyTokens(
          userId,
          encryptedAccessToken,
          encryptedRefreshToken,
          spotifyProduct,
        );

        // Verifica se foi salvo corretamente
        const verifyUser = await this.userService.findUserByID(userId);
        console.log(
          '[SpotifyStrategy] Usuário atualizado com sucesso. Verificação:',
          {
            isSpotifyConnected: verifyUser.isSpotifyConnected,
            hasSpotifyAccessToken: !!verifyUser.spotifyAccessToken,
            hasSpotifyRefreshToken: !!verifyUser.spotifyRefreshToken,
            spotifyProduct: verifyUser.spotifyProduct,
          },
        );

        if (!verifyUser.isSpotifyConnected) {
          console.error(
            '[SpotifyStrategy] ERRO: isSpotifyConnected ainda é FALSE após update!',
          );
        }
        if (!verifyUser.spotifyAccessToken) {
          console.error(
            '[SpotifyStrategy] ERRO: spotifyAccessToken não foi salvo!',
          );
        }
      } catch (error: any) {
        console.error('[SpotifyStrategy] Erro ao salvar tokens do Spotify:', {
          error: error.message,
          stack: error.stack,
          userId,
        });
        throw new UnauthorizedException(
          `Erro ao salvar tokens do Spotify: ${error.message}`,
        );
      }

      try {
        await this.logsService.createLog(
          userId,
          LogActionType.MEDIA_CONNECT_SPOTIFY,
          'Spotify connected',
        );
        console.log('[SpotifyStrategy] Log de conexão criado com sucesso');
      } catch (error) {
        // Log de erro não deve impedir a conexão
        console.error('[SpotifyStrategy] Erro ao criar log:', error);
      }

      // Retorna o usuário completo (sem senha) para o Passport
      const { password, createdAt, updatedAt, deletedAt, ...userData } = user;
      console.log('[SpotifyStrategy] Validate concluído com sucesso');
      return userData;
    } catch (error: any) {
      // Log detalhado do erro para debug
      console.error('[SpotifyStrategy] Erro no validate do Spotify Strategy:', {
        error: error.message,
        stack: error.stack,
        query: req.query,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        hasProfile: !!profile,
      });
      throw error;
    }
  }
}
