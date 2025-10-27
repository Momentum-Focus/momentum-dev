import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegisterUserRoleDTO } from './dtos/registerUserRole.dto';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateUserRoleDTO } from './dtos/updateUserRole.dto';

@Injectable()
export class UserRoleService {
  constructor(private prisma: PrismaService) {}

  async create(
    registerUserRole: RegisterUserRoleDTO,
  ): Promise<UserRole | null> {
    const newUserRole = await this.prisma.userRole.create({
      data: {
        userId: registerUserRole.userId,
        roleId: registerUserRole.roleId,
      },
    });

    if (!newUserRole) {
      throw new BadRequestException(
        'Não foi possivel criar um Usuario com cargo.',
        {
          cause: new Error(),
          description: 'Erro ao inserir o usuario e o cargo na tabela UserRole',
        },
      );
    }

    return newUserRole;
  }

  async updateUserRole(
    id: number,
    updateUserRole: UpdateUserRoleDTO,
  ): Promise<UserRole | null> {
    await this.findUserRole(id);

    const updatedUserRole = await this.prisma.userRole.update({
      where: { id },
      data: { roleId: updateUserRole.roleId },
    });

    return updatedUserRole;
  }

  async findUserRole(id: number) {
    const validateUserRole = await this.prisma.userRole.findFirst({
      where: { id },
    });

    if (!validateUserRole)
      throw new NotFoundException('ID inválido', {
        cause: new Error(),
        description:
          'Usuário não encontrado na tabela UserRole, verifique o ID e tente novamente.',
      });

    return validateUserRole;
  }

  async deleteUserRole(id: number) {
    await this.findUserRole(id);

    await this.prisma.userRole.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Usuário e cargo deletado com sucesso!' };
  }

  async deleteUserRolesByUserId(userId: number) {
    await this.prisma.userRole.updateMany({
      where: { userId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Roles do usuário deletadas com sucesso!' };
  }
}
