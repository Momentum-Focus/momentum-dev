import { Injectable, ConflictException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleLoginStrategy extends PassportStrategy(
  GoogleStrategy,
  'google-login',
) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const clientSecret =
      configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const callbackURL = configService.get<string>('GOOGLE_REDIRECT_URI');

    // Debug log to verify the exact URL being used
    console.log('[GoogleLoginStrategy] GOOGLE_REDIRECT_URI:', callbackURL);
    console.log(
      '[GoogleLoginStrategy] Raw env value:',
      process.env.GOOGLE_REDIRECT_URI,
    );

    if (!clientID || !clientSecret) {
      throw new Error(
        'GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem estar configurados no .env',
      );
    }

    if (!callbackURL) {
      throw new Error('GOOGLE_REDIRECT_URI deve estar configurado no .env');
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const result = await this.authService.loginWithGoogle(profile);
    return result.user;
  }
}
