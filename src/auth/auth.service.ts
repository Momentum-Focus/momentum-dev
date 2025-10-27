import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { RoleService } from 'src/role/role.service';
import { UserRoleService } from 'src/user-role/user-role.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
    private roleService: RoleService,
    private userRoleService: UserRoleService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUserByEmail(email, true);

    if (!user || !user.password) return null;

    const isMatch = await bcrypt.compare(pass, user.password);

    if (!isMatch) return null;

    const { password, createdAt, updatedAt, deletedAt, ...data } = user;

    return data;
  }

  async register(registerUserDTO: RegisterUserDTO) {
    const registedUser = await this.prisma.$transaction(async () => {
      const newUser = await this.userService.create(registerUserDTO);

      const role = await this.roleService.findRole('USER');

      if (!newUser?.id)
        throw new BadRequestException(
          'Não foi possivel encontrar o id do usuario.',
          {
            cause: new Error(),
            description:
              'Provavelmente o usuario não foi inserido na tabela User.',
          },
        );

      const userRole = {
        userId: newUser.id,
        roleId: role,
      };

      await this.userRoleService.create(userRole);

      return newUser;
    });

    const { password, createdAt, updatedAt, deletedAt, ...registerData } =
      registedUser;

    // Gere um token para o usuário recém-criado
    const payload = { sub: registerData.id, email: registerData.email };

    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Usuario cadastrado com sucesso!',
      user: registerData,
      token,
    };
  }

  async generateToken(user: any) {
    const payload = { sub: user.id, email: user.email };

    const token = await this.jwtService.signAsync(payload);

    return {
      message: 'Usuario logado com sucesso!',
      user,
      token,
    };
  }
}
