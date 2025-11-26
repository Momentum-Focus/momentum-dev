import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { UserService } from 'src/user/user.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';
import { encrypt } from '../helpers/encryption.helper';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class GoogleYouTubeStrategy extends PassportStrategy(
  GoogleStrategy,
  'google-youtube',
) {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
    private logsService: LogsService,
  ) {
    const redirectUri = configService.get<string>(
      'GOOGLE_YOUTUBE_REDIRECT_URI',
    );

    // Debug log to verify the exact URL being used
    console.log(
      '[GoogleYouTubeStrategy] GOOGLE_YOUTUBE_REDIRECT_URI:',
      redirectUri,
    );
    console.log(
      '[GoogleYouTubeStrategy] Raw env value:',
      process.env.GOOGLE_YOUTUBE_REDIRECT_URI,
    );

    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') || '';

    if (!clientID || !clientSecret) {
      throw new Error(
        'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem estar configurados no .env',
      );
    }

    if (!redirectUri) {
      throw new Error(
        'GOOGLE_YOUTUBE_REDIRECT_URI deve estar configurado no .env',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL: redirectUri,
      passReqToCallback: true,
      scope: ['https://www.googleapis.com/auth/youtube'],
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    let userId: number | null = null;

    if (req.user && req.user.id) {
      userId = req.user.id;
    }

    if (!userId && req.query.state) {
      try {
        const stateData = JSON.parse(
          Buffer.from(req.query.state as string, 'base64').toString(),
        );

        if (stateData.userId) {
          userId = stateData.userId;
        }

        if (!userId && stateData.token) {
          const secret = this.configService.get<string>('JWT_SECRET');
          if (secret && stateData.token) {
            const decoded = jwt.verify(stateData.token, secret) as unknown as {
              sub: number;
            };
            if (decoded && decoded.sub) {
              userId = decoded.sub;
            }
          }
        }
      } catch (error) {
        throw new Error('Invalid state parameter');
      }
    }

    if (!userId) {
      throw new Error('Usuário não autenticado');
    }

    const user = await this.userService.findUserByID(userId);

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

    return user;
  }
}
