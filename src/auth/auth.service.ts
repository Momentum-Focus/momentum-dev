import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
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
  private readonly logger = new Logger(AuthService.name);

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
      this.logger.log(`Iniciando registro para: ${registerUserDTO.email}`);

      const registedUser = await this.prisma.$transaction(async () => {
        try {
          this.logger.log('Criando usuário na tabela User...');
          const newUser = await this.userService.create(registerUserDTO);

          if (!newUser?.id) {
            this.logger.error('Usuário criado mas sem ID retornado');
            throw new InternalServerErrorException(
              'Erro ao criar usuário: ID não foi retornado após criação.',
            );
          }

          this.logger.log(`Usuário criado com ID: ${newUser.id}`);

          this.logger.log('Buscando role USER...');
          const roleId = await this.roleService.findRole('USER');
          this.logger.log(`Role USER encontrada com ID: ${roleId}`);

          if (!roleId) {
            this.logger.error('Role USER não encontrada no banco de dados');
            throw new InternalServerErrorException(
              'Erro ao configurar permissões: Role USER não encontrada. Contate o suporte.',
            );
          }

          const userRole = {
            userId: newUser.id,
            roleId: roleId,
          };

          this.logger.log('Criando relação User-Role...');
          await this.userRoleService.create(userRole);
          this.logger.log('Relação User-Role criada com sucesso');

          return newUser;
        } catch (error) {
          this.logger.error('Erro na transação de registro:', error.stack);
          throw error;
        }
      });

      this.logger.log('Processando dados do usuário para resposta...');
      const { password, createdAt, updatedAt, deletedAt, ...registerData } =
        registedUser;

      this.logger.log('Gerando token JWT...');
      const payload = { sub: registerData.id, email: registerData.email };
      const token = await this.jwtService.signAsync(payload);

      if (!token) {
        this.logger.error('Token não foi gerado');
        throw new InternalServerErrorException(
          'Erro ao gerar token de autenticação. Tente fazer login manualmente.',
        );
      }

      this.logger.log(
        `Registro concluído com sucesso para: ${registerData.email}`,
      );

      return {
        message: 'Usuario cadastrado com sucesso!',
        user: registerData,
        token,
      };
    } catch (error) {
      this.logger.error(
        `Erro completo no registro de ${registerUserDTO.email}:`,
        error,
      );

      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      // Erro do Prisma ou outro erro não tratado
      if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'campo';
        throw new BadRequestException(
          `Este ${field} já está em uso. Tente outro ${field}.`,
        );
      }

      throw new InternalServerErrorException(
        `Erro interno ao processar registro: ${error.message}. Tente novamente ou contate o suporte.`,
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
