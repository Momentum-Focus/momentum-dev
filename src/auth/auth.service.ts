import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterUserDTO } from 'src/user/dtos/registerUser.dto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { RoleService } from 'src/role/role.service';
import { UserRoleService } from 'src/user-role/user-role.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType, AuthMethod } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private userService: UserService,
    private roleService: RoleService,
    private userRoleService: UserRoleService,
    private logsService: LogsService,
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
    const existingEmail = await this.prisma.user.findFirst({
      where: {
        email: registerUserDTO.email,
        deletedAt: null,
      },
    });

    if (existingEmail) {
      throw new ConflictException('Este email já está cadastrado.');
    }

    if (registerUserDTO.phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone: registerUserDTO.phone,
          deletedAt: null,
        },
      });

      if (existingPhone) {
        throw new ConflictException('Este telefone já está cadastrado.');
      }
    }

    const hashedPassword = await bcrypt.hash(registerUserDTO.password, 10);

    const roleId = await this.roleService.findRole('USER');

    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: registerUserDTO.name,
          email: registerUserDTO.email,
          phone: registerUserDTO.phone || null,
          password: hashedPassword,
          authMethod: AuthMethod.EMAIL,
          emailVerified: false,
          cpf: null,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleId,
        },
      });

      await this.logsService.createLog(
        newUser.id,
        LogActionType.USER_REGISTER,
        'Email/Password Register',
      );

      const { password, createdAt, updatedAt, deletedAt, ...userData } =
        newUser;

      const payload = { sub: userData.id, email: userData.email };
      const token = await this.jwtService.signAsync(payload);

      return {
        message: 'Usuario cadastrado com sucesso!',
        user: userData,
        token,
      };
    });

    return result;
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

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    if (user.authMethod !== AuthMethod.EMAIL) {
      throw new BadRequestException(
        'Este email está cadastrado com login via Google. Use "Continuar com Google".',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password || '');

    if (!isPasswordValid) {
      await this.logsService.createLog(
        user.id,
        LogActionType.USER_LOGIN_FAILED,
        'Email/Password Login Failed',
      );
      throw new UnauthorizedException('Email ou senha inválidos.');
    }

    await this.logsService.createLog(
      user.id,
      LogActionType.USER_LOGIN_SUCCESS,
      'Email/Password Login',
    );

    const { password: _, createdAt, updatedAt, deletedAt, ...userData } = user;

    const payload = { sub: userData.id, email: userData.email };
    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: userData,
    };
  }

  async loginWithGoogle(profile: {
    id: string;
    emails: Array<{ value: string }>;
    displayName: string;
  }) {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;

    if (!email) {
      throw new ConflictException('Email não fornecido pelo Google');
    }

    const existingUserByGoogleId = await this.prisma.user.findFirst({
      where: {
        googleId,
        deletedAt: null,
      },
    });

    if (existingUserByGoogleId) {
      await this.logsService.createLog(
        existingUserByGoogleId.id,
        LogActionType.USER_LOGIN_SUCCESS,
        'Google Login',
      );

      const {
        password,
        createdAt,
        updatedAt,
        deletedAt,
        ...userData
      } = existingUserByGoogleId;

      const payload = { sub: userData.id, email: userData.email };
      const access_token = await this.jwtService.signAsync(payload);

      return {
        access_token,
        user: userData,
      };
    }

    const existingUserByEmail = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (existingUserByEmail) {
      const updatedUser = await this.prisma.user.update({
        where: { id: existingUserByEmail.id },
        data: {
          googleId,
          emailVerified: true,
        },
      });

      await this.logsService.createLog(
        updatedUser.id,
        LogActionType.USER_LOGIN_SUCCESS,
        'Google Login (Linked Account)',
      );

      const { password, createdAt, updatedAt, deletedAt, ...userData } =
        updatedUser;

      const payload = { sub: userData.id, email: userData.email };
      const access_token = await this.jwtService.signAsync(payload);

      return {
        access_token,
        user: userData,
      };
    }

    const roleId = await this.roleService.findRole('USER');

    const result = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: name || email.split('@')[0],
          email,
          googleId,
          authMethod: AuthMethod.GOOGLE,
          emailVerified: true,
          password: null,
          phone: null,
          cpf: null,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleId,
        },
      });

      await this.logsService.createLog(
        newUser.id,
        LogActionType.USER_REGISTER,
        'Google Register',
      );

      const { password, createdAt, updatedAt, deletedAt, ...userData } =
        newUser;

      const payload = { sub: userData.id, email: userData.email };
      const access_token = await this.jwtService.signAsync(payload);

      return {
        access_token,
        user: userData,
      };
    });

    return result;
  }
}
