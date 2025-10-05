import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import { RegisterUserDTO } from './dtos/registerUser.dto';
import * as bcrypt from 'bcrypt';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { UserRoleService } from 'src/user-role/user-role.service';

@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private userRolService: UserRoleService,
  ) {}

  async create(registerUser: RegisterUserDTO): Promise<User | null> {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email: registerUser.email, deletedAt: null },
    });

    if (validateEmail) {
      throw new ConflictException(
        'Já existe um usuário cadastrado com esse email!',
        {
          cause: new Error(),
          description:
            'Já existe um usuário com esse email cadastrado. Faça login ou altere o email!',
        },
      );
    }

    const validatePhone = await this.prisma.user.findFirst({
      where: {
        phone: registerUser.phone,
        deletedAt: null,
      },
    });

    if (validatePhone) {
      throw new ConflictException('Telefone encontrado no banco de dados!', {
        cause: new Error(),
        description: 'Já existe um usuário com esse numero cadastrado.',
      });
    }

    const encrypetedPassword = await bcrypt.hash(registerUser.password, 10);

    const newUser = await this.prisma.user.create({
      data: {
        ...registerUser,
        password: encrypetedPassword,
      },
    });

    if (!newUser) {
      throw new BadRequestException('Erro ao criar usuário.', {
        cause: new Error(),
        description:
          'Erro ao inserir o usuário no banco de dados, verifique a conexão com o banco.',
      });
    }

    const { password, createdAt, updatedAt, deletedAt, ...dataNewUser } =
      newUser;

    return dataNewUser as User;
  }

  async update(
    userId: number,
    updateUser: UpdateUserDTO,
  ): Promise<User | null> {
    await this.findUserByID(userId);

    if (updateUser.email) {
      const validateEmail = await this.prisma.user.findFirst({
        where: {
          email: updateUser.email,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validateEmail)
        throw new ConflictException('Email já cadastrado!', {
          cause: new Error(),
          description:
            'Existe um usuário com esse email cadastrado, insira um email diferente e tente novamente!',
        });
    }

    if (updateUser.phone) {
      const validatePhone = await this.prisma.user.findFirst({
        where: {
          email: updateUser.phone,
          deletedAt: null,
          NOT: { id: userId },
        },
      });

      if (validatePhone)
        throw new ConflictException('Telefone já cadastrado!', {
          cause: new Error(),
          description:
            'Existe um usuário com esse telefone cadastrado, insira um telefone diferente e tente novamente!',
        });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateUser,
      },
    });

    const { password, createdAt, updatedAt, deletedAt, ...dataUserUpdated } =
      updatedUser;

    return dataUserUpdated as User;
  }

  async listUsers(): Promise<User[] | []> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
    });

    return users.map((user) => {
      const { password, ...datasUsers } = user;

      return datasUsers as User;
    });
  }

  async findUserByID(userId: number): Promise<User | null> {
    const validateUser = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!validateUser)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const { password, createdAt, updatedAt, deletedAt, ...data } = validateUser;

    return data as User;
  }

  async findByIdWithRoles(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user)
      throw new NotFoundException('ID inválido.', {
        cause: new Error(),
        description:
          'Usuário não encontrado, id inválido, verifique e tente novamente.',
      });

    return user;
  }

  async findUserByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | null> {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if (!validateEmail) return null;

    if (includePassword) return validateEmail as User;

    const { password, createdAt, updatedAt, deletedAt, ...data } =
      validateEmail;

    return data as User;
  }

  async deleteMyAccount(userId: number): Promise<{ message: string }> {
    const validateUser = await this.findUserByID(userId);

    if (!validateUser)
      throw new NotFoundException('Usuário não encontrado!', {
        cause: new Error(),
        description:
          'Usuário não foi encontrado, verifique o ID enviado e tente novamente.',
      });

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await this.userRolService.deleteUserRole(userId);

    return { message: 'Usuário deletado com sucesso!' };
  }
}
