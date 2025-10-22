import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Habilitar CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  });
  
  // Endpoint de health check
  app.getHttpAdapter().get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
  
  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Aplicação rodando na porta ${process.env.PORT ?? 3000}`);
}
bootstrap();
