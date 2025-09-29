import { BadRequestException, Injectable } from '@nestjs/common';
import { RegisterUserRoleDTO } from './dtos/registerUserRole.dto';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

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

    if(!newUserRole) {
        throw new BadRequestException('Não foi possivel criar um Usuario com cargo.', {
            cause: new Error(),
            description: 'Erro ao inserir o usuario e o cargo na tabela UserRole'
        })
    }

    return newUserRole;
  }
}
