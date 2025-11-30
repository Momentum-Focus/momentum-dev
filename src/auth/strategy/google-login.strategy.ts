import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleLoginStrategy extends PassportStrategy(
  GoogleStrategy,
  'google-login',
) {
  private readonly logger = new Logger(GoogleLoginStrategy.name);

  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    // Logs detalhados para diagnóstico (usando console.log antes de super())
    console.log(
      '[GoogleLoginStrategy] === Inicializando GoogleLoginStrategy ===',
    );

    // Tenta obter valores do ConfigService primeiro
    let clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    let clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    let callbackURL = configService.get<string>('GOOGLE_REDIRECT_URI');

    // Fallback para process.env se ConfigService não retornar
    if (!clientID) {
      console.warn(
        '[GoogleLoginStrategy] GOOGLE_CLIENT_ID não encontrado no ConfigService, tentando process.env...',
      );
      clientID = process.env.GOOGLE_CLIENT_ID || '';
    }
    if (!clientSecret) {
      console.warn(
        '[GoogleLoginStrategy] GOOGLE_CLIENT_SECRET não encontrado no ConfigService, tentando process.env...',
      );
      clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    }
    if (!callbackURL) {
      console.warn(
        '[GoogleLoginStrategy] GOOGLE_REDIRECT_URI não encontrado no ConfigService, tentando process.env...',
      );
      callbackURL = process.env.GOOGLE_REDIRECT_URI || '';
    }

    // Logs detalhados de diagnóstico
    console.log('[GoogleLoginStrategy] Valores obtidos:');
    console.log(
      `[GoogleLoginStrategy]   GOOGLE_CLIENT_ID: ${clientID ? '✓ Configurado (' + clientID.substring(0, 10) + '...)' : '✗ FALTANDO'}`,
    );
    console.log(
      `[GoogleLoginStrategy]   GOOGLE_CLIENT_SECRET: ${clientSecret ? '✓ Configurado (' + clientSecret.substring(0, 10) + '...)' : '✗ FALTANDO'}`,
    );
    console.log(
      `[GoogleLoginStrategy]   GOOGLE_REDIRECT_URI: ${callbackURL ? '✓ Configurado (' + callbackURL + ')' : '✗ FALTANDO'}`,
    );

    // Validações robustas com mensagens específicas
    const missingVars: string[] = [];

    if (!clientID || clientID.trim() === '') {
      missingVars.push('GOOGLE_CLIENT_ID');
    }
    if (!clientSecret || clientSecret.trim() === '') {
      missingVars.push('GOOGLE_CLIENT_SECRET');
    }
    if (!callbackURL || callbackURL.trim() === '') {
      missingVars.push('GOOGLE_REDIRECT_URI');
    }

    if (missingVars.length > 0) {
      const errorMessage = `❌ ERRO CRÍTICO: As seguintes variáveis de ambiente estão faltando ou vazias: ${missingVars.join(', ')}. Configure-as no arquivo .env e reinicie o servidor.`;
      console.error(`[GoogleLoginStrategy] ${errorMessage}`);
      console.error(
        '[GoogleLoginStrategy] O servidor continuará rodando, mas o login com Google não funcionará.',
      );

      // Em vez de lançar erro que derruba o servidor, apenas loga e usa valores vazios
      // O Passport vai falhar de forma controlada quando tentar usar
      super({
        clientID: clientID || 'MISSING_CLIENT_ID',
        clientSecret: clientSecret || 'MISSING_CLIENT_SECRET',
        callbackURL:
          callbackURL || 'http://localhost:3000/auth/google/callback',
        scope: ['profile', 'email'],
      });
      return;
    }

    // Validação adicional: verifica se a URL do callback é válida
    try {
      new URL(callbackURL);
    } catch (urlError) {
      console.error(
        `[GoogleLoginStrategy] ❌ GOOGLE_REDIRECT_URI inválido: "${callbackURL}". Deve ser uma URL válida (ex: http://localhost:3000/auth/google/callback)`,
      );
      throw new Error(
        `GOOGLE_REDIRECT_URI inválido: "${callbackURL}". Deve ser uma URL válida.`,
      );
    }

    console.log(
      '[GoogleLoginStrategy] ✓ Todas as variáveis estão configuradas corretamente',
    );
    console.log('[GoogleLoginStrategy] ✓ Inicializando Passport Strategy...');

    try {
      // NOTA: authorizationParams não pode ser passado diretamente no super()
      // porque passport-google-oauth20 não suporta essa propriedade no construtor.
      // A solução é sobrescrever o método authenticate() para injetar os parâmetros
      // de autorização (prompt: 'select_account') dinamicamente em cada requisição.
      // Isso garante que o Google sempre mostre a tela de seleção de conta.
      super({
        clientID,
        clientSecret,
        callbackURL,
        scope: ['profile', 'email'],
      });
      console.log(
        '[GoogleLoginStrategy] ✓ GoogleLoginStrategy inicializada com sucesso',
      );
      console.log(
        '[GoogleLoginStrategy] ℹ️  prompt=select_account será aplicado via método authenticate()',
      );
    } catch (passportError: any) {
      console.error(
        '[GoogleLoginStrategy] ❌ Erro ao inicializar Passport Strategy:',
        passportError.message,
      );
      console.error('[GoogleLoginStrategy] Stack trace:', passportError.stack);
      throw new Error(
        `Falha ao inicializar estratégia do Google: ${passportError.message}`,
      );
    }
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
          this.logger.warn(
            `[GoogleLoginStrategy] ⚠️  prompt não estava na URL, adicionando manualmente`,
          );
          this.logger.debug(`[GoogleLoginStrategy] URL original: ${url}`);
          this.logger.debug(
            `[GoogleLoginStrategy] URL modificada: ${urlObj.toString()}`,
          );
          return originalRedirect.call(req.res, urlObj.toString());
        } else {
          // Verifica se o valor está correto
          const currentPrompt = urlObj.searchParams.get('prompt');
          if (currentPrompt !== 'select_account') {
            urlObj.searchParams.set('prompt', 'select_account');
            this.logger.warn(
              `[GoogleLoginStrategy] ⚠️  prompt tinha valor '${currentPrompt}', alterando para 'select_account'`,
            );
            return originalRedirect.call(req.res, urlObj.toString());
          }
        }
        return originalRedirect.call(req.res, url);
      };
    }

    // Log detalhado para debug
    this.logger.log(
      `[GoogleLoginStrategy] 🔐 Forçando seleção de conta - prompt=select_account, access_type=offline, include_granted_scopes=false`,
    );
    this.logger.debug(
      `[GoogleLoginStrategy] Options: ${JSON.stringify(options)}`,
    );
    this.logger.debug(
      `[GoogleLoginStrategy] AuthorizationParams: ${JSON.stringify(options.authorizationParams)}`,
    );

    // IMPORTANTE: Verifica se o prompt está realmente configurado
    if (options.authorizationParams?.prompt !== 'select_account') {
      this.logger.error(
        `[GoogleLoginStrategy] ❌ ERRO: prompt não está configurado como 'select_account'!`,
      );
      this.logger.error(
        `[GoogleLoginStrategy] AuthorizationParams atual: ${JSON.stringify(options.authorizationParams)}`,
      );
    } else {
      this.logger.log(
        `[GoogleLoginStrategy] ✅ prompt=select_account confirmado antes do redirecionamento`,
      );
    }

    // Chama o método authenticate da classe pai com as opções configuradas
    super.authenticate(req, options);
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
