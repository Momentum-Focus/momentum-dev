import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/register')
  register(@Body() registerUser: RegisterUserDTO) {
    return this.authService.register(registerUser);
  }

  @UseGuards(AuthGuard('local'))
  @Post('/login')
  login(@Request() req: any) {
    return this.authService.generateToken(req.user);
  }
}
