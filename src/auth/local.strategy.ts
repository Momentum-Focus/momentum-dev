import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, pass: string): Promise<any> {
    const user = await this.authService.validateUser(email, pass);

    if (!user)
      throw new UnauthorizedException('Email/Senha inválido!', {
        cause: new Error(),
        description: 'O email ou a senha estão incorretos, altere e tente novamente.',
      });

    return user;
  }
}
