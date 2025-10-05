import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDTO } from './dtos/createRole.dto';
import { UpdateRoleDTO } from './dtos/updateRole.dto';
import { Role } from '@prisma/client';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async createRole(createRole: CreateRoleDTO): Promise<Role | null> {
    const newRole = await this.prisma.role.create({
      data: {
        ...createRole,
      },
    });

    const { createdAt, updatedAt, deletedAt, ...dataRole } = newRole;

    return dataRole as Role;
  }

  async updateRole(
    id: number,
    updateRole: UpdateRoleDTO,
  ): Promise<Role | null> {
    await this.findRoleById(id);

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        ...updateRole,
      },
    });

    const { createdAt, updatedAt, deletedAt, ...dataRole } = updatedRole;

    return dataRole as Role;
  }

  async findRoleById(id: number): Promise<Role | null> {
    const validateRole = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
    });

    if (!validateRole)
      throw new ConflictException(
        'Não foi encontrado um cargo com esse nome!',
        {
          cause: new Error(),
          description:
            'Não foi encontrado nenhum cargo com esse nome, insira outro nome e tente novamente.',
        },
      );

    return validateRole;
  }

  async findRole(name: string) {
    const validateRole = await this.prisma.role.findFirst({
      where: { name, deletedAt: null },
    });

    if (!validateRole)
      throw new ConflictException(
        'Não foi encontrado um cargo com esse nome!',
        {
          cause: new Error(),
          description:
            'Não foi encontrado nenhum cargo com esse nome, insira outro nome e tente novamente.',
        },
      );

    return validateRole.id;
  }

  async findAllRoles(): Promise<Role[] | []> {
    const roles = await this.prisma.role.findMany();

    return roles.map((role) => {
      const { createdAt, updatedAt, deletedAt, ...dataRoles } = role;

      return dataRoles as Role;
    });
  }

  async deleteRole(id: number): Promise<{ message: string }> {
    await this.findRoleById(id);

    await this.prisma.role.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Role deletada com sucesso!'}
  }
}
