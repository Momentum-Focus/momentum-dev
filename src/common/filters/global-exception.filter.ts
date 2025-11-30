import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly loggingService: LogsService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const userId = (request as any).user?.id || null;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let stackTrace: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || message;
      stackTrace = message;
    }

    if (exception instanceof Error && !(exception instanceof HttpException)) {
      message = exception.message;
      stackTrace = exception.stack;

      // Tratamento especial para erros do Passport/Spotify
      if (
        message.includes('failed to fetch user profile') ||
        message.includes('Failed to fetch user profile')
      ) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message =
          'Erro ao conectar com o Spotify. Por favor, tente novamente em alguns instantes.';

        // Log mais detalhado para debug
        console.error('Erro do Passport/Spotify:', {
          message: exception.message,
          stack: exception.stack,
          url: request.url,
          userId,
        });
      }

      // Tratamento especial para erros de configuração do Google OAuth
      if (
        message.includes('GOOGLE_CLIENT_ID') ||
        message.includes('GOOGLE_CLIENT_SECRET') ||
        message.includes('GOOGLE_REDIRECT_URI') ||
        message.includes('MISSING_CLIENT_ID') ||
        message.includes('MISSING_CLIENT_SECRET') ||
        message.includes('Falha ao inicializar estratégia')
      ) {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message =
          'Erro de configuração do Google OAuth. Verifique as variáveis de ambiente GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.';

        // Log detalhado
        console.error('❌ Erro de configuração do Google OAuth:', {
          message: exception.message,
          stack: exception.stack,
          url: request.url,
          userId,
          envCheck: {
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '✓' : '✗',
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '✓' : '✗',
            GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '✗',
          },
        });
      }
    }

    await this.loggingService.createLog(
      userId,
      LogActionType.GENERIC_ERROR,
      stackTrace || message,
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
