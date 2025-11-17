import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as SpotifyStrategy } from 'passport-spotify';
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
  ) {
    const isProduction = process.env.NODE_ENV === 'production';
    const redirectUri = isProduction
      ? configService.get<string>('SPOTIFY_REDIRECT_URI_PROD') ||
        'https://momentum-api.onrender.com/media/spotify/callback'
      : configService.get<string>('SPOTIFY_REDIRECT_URI') ||
        'http://127.0.0.1:3000/media/spotify/callback';

    const clientID = configService.get<string>('SPOTIFY_CLIENT_ID') || '';
    const clientSecret = configService.get<string>('SPOTIFY_CLIENT_SECRET') || '';

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
      scope: [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'streaming',
        'user-read-email',
        'user-read-private',
      ],
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    // req.user vem do JwtAuthGuard que é executado antes
    const user = req.user;

    if (!user || !user.id) {
      throw new Error('Usuário não autenticado');
    }

    // Criptografa os tokens antes de salvar
    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = encrypt(refreshToken);

    await this.userService.updateSpotifyTokens(
      user.id,
      encryptedAccessToken,
      encryptedRefreshToken,
    );

    await this.logsService.createLog(
      user.id,
      LogActionType.MEDIA_CONNECT_SPOTIFY,
      'Spotify connected',
    );

    return user;
  }
}

