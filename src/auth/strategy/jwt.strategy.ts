import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserService } from 'src/user/user.service';
import { AuthenticatedUser } from '../types/auth.types';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private userService: UserService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Tenta obter o token da query parameter (para popups)
        (req: Request) => {
          if (req.query && req.query.token) {
            return req.query.token as string;
          }
          return null;
        },
        // Fallback para header Authorization
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: { sub: number; email: string }): Promise<AuthenticatedUser> {
    const user = await this.userService.findByIdWithRoles(payload.sub);

    return user;
  }
}