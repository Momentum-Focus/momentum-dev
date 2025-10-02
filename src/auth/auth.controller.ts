import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request
} from '@nestjs/common';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  register(@Body() registerUser: RegisterUserDTO) {
    const data = this.authService.register(registerUser);

    return {
      message: 'Usuario cadastrado com sucesso!',
      user: data,
    };
  }

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  login(@Request() req: any) {
    const data = this.authService.login(req.user)

    return {
        message: 'Usuario logado com sucesso!',
        user: data
    }
  }
}
