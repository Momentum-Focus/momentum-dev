import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
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
    try {
      const newUser = await this.userService.create(registerUserDTO);
      const roleId = await this.roleService.findRole('USER');

      await this.userRoleService.create({
        userId: newUser.id,
        roleId: roleId,
      });

      const { password, createdAt, updatedAt, deletedAt, ...registerData } =
        newUser;

      const payload = { sub: registerData.id, email: registerData.email };
      const token = await this.jwtService.signAsync(payload);

      return {
        message: 'Usuario cadastrado com sucesso!',
        user: registerData,
        token,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'campo';
        throw new BadRequestException(
          `Este ${field} já está em uso. Tente outro ${field}.`,
        );
      }

      throw new InternalServerErrorException(
        `Erro ao processar registro: ${error.message || 'Erro desconhecido'}`,
      );
    }
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
