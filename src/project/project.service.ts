import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDTO } from './dtos/create-project.dto';
import { UpdateProjectDTO } from './dtos/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDTO, userId: number) {
    return this.prisma.project.create({
      data: {
        ...createProjectDto,
        userId: userId,
      },
    });
  }

  async findAll(userId: number) {
    return this.prisma.project.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: number, userId: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: id,
        userId: userId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Projeto não encontrado ou você não tem permissão para acessá-lo.',
      );
    }
    return project;
  }

  async update(id: number, updateProjectDto: UpdateProjectDTO, userId: number) {
    await this.findOne(id, userId);

    return this.prisma.project.update({
      where: {
        id: id,
      },
      data: updateProjectDto,
    });
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId);

    await this.prisma.project.update({
      where: {
        id: id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Projeto deletado com sucesso.' };
  }
}