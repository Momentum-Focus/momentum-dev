import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LogsService } from './logs/logs.service';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    const logsService = app.get(LogsService);
    app.useGlobalFilters(new GlobalExceptionFilter(logsService));

    // Habilitar CORS
    let allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
      : ['http://localhost:8080', 'https://momentum-rouge.vercel.app'];

    // Normalizar origens: adicionar https:// apenas se não tiver protocolo
    allowedOrigins = allowedOrigins.map((origin) => {
      if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        return `https://${origin}`;
      }
      return origin;
    });

    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        // Permitir requisições sem origin (algumas requisições internas)
        if (!origin) {
          return callback(null, true);
        }

        // Normalizar origin (remover trailing slash se houver)
        const normalizedOrigin = origin.replace(/\/$/, '');

        if (
          allowedOrigins.includes(normalizedOrigin) ||
          allowedOrigins.includes(origin)
        ) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
      ],
      exposedHeaders: ['Content-Length', 'Content-Type'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      maxAge: 86400, // 24 horas
    });

    // Endpoint de health check
    app.getHttpAdapter().get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    await app.listen(process.env.PORT ?? 3000);
    console.log(`🚀 Aplicação rodando na porta ${process.env.PORT ?? 3000}`);
  } catch (error: any) {
    console.error('❌ ERRO CRÍTICO ao inicializar a aplicação:', error.message);
    console.error('Stack trace:', error.stack);

    // Verifica se é erro de configuração do Google OAuth
    if (
      error.message?.includes('GOOGLE') ||
      error.message?.includes('Google') ||
      error.stack?.includes('GoogleLoginStrategy')
    ) {
      console.error('\n⚠️  ATENÇÃO: Erro relacionado ao Google OAuth.');
      console.error(
        'Verifique se as seguintes variáveis estão configuradas no .env:',
      );
      console.error('  - GOOGLE_CLIENT_ID');
      console.error('  - GOOGLE_CLIENT_SECRET');
      console.error('  - GOOGLE_REDIRECT_URI');
      console.error(
        '\nO servidor não será iniciado até que essas variáveis estejam corretas.\n',
      );
    }

    process.exit(1);
  }
}
bootstrap();
