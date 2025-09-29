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
import { LoginUserDTO } from './dto/loginUser.dto';
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

    if (!user) return null;

    await bcrypt.compare(pass, user.password);

    const { password, createdAt, updatedAt, deletedAt, ...data } = user;

    return data;
  }

  async login(loginUser: LoginUserDTO) {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email: loginUser.email, deletedAt: null },
    });

    if (!validateEmail)
      throw new NotFoundException('Email não encontrado', {
        cause: new Error(),
        description:
          'Nenhum usuario cadastrado com esse email. Por favor insira outro email.',
      });

    const validPassword = await bcrypt.compare(
      loginUser.password,
      validateEmail.password,
    );

    if (!validPassword)
      throw new BadRequestException('Senha incorreta!', {
        cause: new Error(),
        description: 'A senha que o usario inseriu está incorreta!',
      });

    const payload = { sub: validateEmail.id, email: validateEmail.email };

    const token = await this.jwtService.signAsync(payload);

    const {
      password: __,
      createdAt,
      updatedAt,
      deletedAt,
      ...loginData
    } = validateEmail;

    const data = { ...loginData, token };

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

    const payload = { email: registerData.email, password };

    const login = await this.login(payload);

    const data = { registerData, token: login.token };

    return data;
  }
}
