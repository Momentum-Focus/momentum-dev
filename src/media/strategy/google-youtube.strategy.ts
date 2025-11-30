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

  authenticate(req: any, options?: any): void {
    // CRÍTICO: Força sempre mostrar a tela de escolha de conta
    // Isso garante que o usuário sempre veja a tela de seleção, mesmo se já estiver logado
    options = options || {};

    // Inicializa authorizationParams se não existir
    if (!options.authorizationParams) {
      options.authorizationParams = {};
    }

    // FORÇA a tela de seleção de conta SEMPRE
    // prompt: 'select_account' é OBRIGATÓRIO para garantir que o Google mostre a tela de escolha
    options.authorizationParams.prompt = 'select_account';
    options.authorizationParams.access_type = 'offline';

    // Parâmetros adicionais para forçar a seleção de conta
    // include_granted_scopes: false força uma nova autorização
    options.authorizationParams.include_granted_scopes = false;

    // TENTATIVA ALTERNATIVA: Passar prompt diretamente nas opções também
    // Algumas versões do passport-google-oauth20 podem não usar authorizationParams
    options.prompt = 'select_account';

    // Adiciona um parâmetro de estado único para evitar cache do navegador
    // Isso força o Google a tratar cada requisição como única
    if (!options.state) {
      options.state = `state_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Intercepta o redirecionamento para garantir que o prompt está na URL
    const originalRedirect = req.res?.redirect;
    if (originalRedirect && req.res) {
      req.res.redirect = (url: string) => {
        // Verifica se a URL contém o parâmetro prompt
        const urlObj = new URL(url);
        if (!urlObj.searchParams.has('prompt')) {
          // Adiciona o parâmetro prompt=select_account se não estiver presente
          urlObj.searchParams.set('prompt', 'select_account');
          console.warn(
            `[GoogleYouTubeStrategy] ⚠️  prompt não estava na URL, adicionando manualmente`,
          );
          console.debug(`[GoogleYouTubeStrategy] URL original: ${url}`);
          console.debug(
            `[GoogleYouTubeStrategy] URL modificada: ${urlObj.toString()}`,
          );
          return originalRedirect.call(req.res, urlObj.toString());
        } else {
          // Verifica se o valor está correto
          const currentPrompt = urlObj.searchParams.get('prompt');
          if (currentPrompt !== 'select_account') {
            urlObj.searchParams.set('prompt', 'select_account');
            console.warn(
              `[GoogleYouTubeStrategy] ⚠️  prompt tinha valor '${currentPrompt}', alterando para 'select_account'`,
            );
            return originalRedirect.call(req.res, urlObj.toString());
          }
        }
        return originalRedirect.call(req.res, url);
      };
    }

    // Log detalhado para debug
    console.log(
      `[GoogleYouTubeStrategy] 🔐 Forçando seleção de conta - prompt=select_account, access_type=offline, include_granted_scopes=false`,
    );
    console.log(`[GoogleYouTubeStrategy] Options: ${JSON.stringify(options)}`);
    console.log(
      `[GoogleYouTubeStrategy] AuthorizationParams: ${JSON.stringify(options.authorizationParams)}`,
    );

    // Chama o método authenticate da classe pai com as opções configuradas
    super.authenticate(req, options);
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
