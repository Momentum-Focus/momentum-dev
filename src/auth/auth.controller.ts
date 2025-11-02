import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  async register(@Body() registerUser: RegisterUserDTO) {
    try {
      this.logger.log(`Tentativa de registro para: ${registerUser.email}`);
      const result = await this.authService.register(registerUser);
      this.logger.log(`Registro bem-sucedido para: ${registerUser.email}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Erro ao registrar usuário ${registerUser.email}:`,
        error.stack,
      );

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

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  login(@Request() req: any) {
    return this.authService.generateToken(req.user);
  }
}
