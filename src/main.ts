import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:8080', 'https://momentum-rouge.vercel.app'];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin
      if (!origin) {
        return callback(null, true);
      }
      // Verificar se a origin está permitida
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS bloqueado para origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
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
