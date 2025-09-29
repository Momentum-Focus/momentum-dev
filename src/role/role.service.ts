import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

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
}
