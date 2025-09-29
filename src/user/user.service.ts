import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { User } from '@prisma/client';
import { RegisterUserDTO } from './dtos/registerUser.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

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

    return newUser;
  }

  async findUserByID(userId: number) {
    const validateUser = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!validateUser)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const { password, createdAt, updatedAt, deletedAt, ...data } = validateUser;

    return data;
  }

  async findUserByEmail(email: string, includePassword = false): Promise<User | null> {
    const validateEmail = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    if(!validateEmail) return null;

    if(includePassword) return validateEmail as User;

    const { password, createdAt, updatedAt, deletedAt, ...data } = validateEmail;

    return data as User;
  }
}
