import {
  Body,
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  async register(@Body() registerUser: RegisterUserDTO) {
    try {
      return await this.authService.register(registerUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          message: 'Erro interno ao criar conta. Tente novamente.',
          error: 'Erro desconhecido durante o registro',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('/login')
  async login(@Body() loginDTO: { email: string; password: string }) {
    return await this.authService.login(loginDTO.email, loginDTO.password);
  }

  @Get('google/login')
  @UseGuards(AuthGuard('google-login'))
  handleGoogleLogin(@Request() req: any, @Res() res: any) {
    try {
      // O Guard redireciona automaticamente para o Google
      // Se chegar aqui, significa que o Passport não redirecionou
      // Isso pode indicar um problema de configuração
      this.logger.warn(
        'Passport não redirecionou para o Google. Verifique a configuração.',
      );
      return res.status(500).json({
        message:
          'Erro ao iniciar autenticação com Google. Verifique as configurações do servidor.',
        hint: 'Verifique se GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI estão configurados.',
      });
    } catch (error: any) {
      this.logger.error('Erro ao processar login do Google:', error.message);
      return res.status(500).json({
        message: 'Erro interno ao processar login do Google.',
        error: error.message,
      });
    }
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google-login'))
  async handleGoogleCallback(@Request() req: any, @Res() res: Response) {
    const result = await this.authService.generateToken(req.user);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.token}`);
  }
}
