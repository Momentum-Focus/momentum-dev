import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  let allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:8080', 'https://momentum-rouge.vercel.app'];

  // Normalizar origens: adicionar https:// se não tiver protocolo
  allowedOrigins = allowedOrigins.map((origin) => {
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
      return `https://${origin}`;
    }
    return origin;
  });

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (algumas requisições internas)
      if (!origin) {
        return callback(null, true);
      }

      // Normalizar origin (remover trailing slash se houver)
      const normalizedOrigin = origin.replace(/\/$/, '');

      // Verificar se a origin está permitida
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
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
}
bootstrap();
