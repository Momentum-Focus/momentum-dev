import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDTO } from './dtos/create-project.dto';
import { UpdateProjectDTO } from './dtos/update-project.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async create(createProjectDto: CreateProjectDTO, userId: number) {
    const project = await this.prisma.project.create({
      data: {
        ...createProjectDto,
        userId: userId,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.PROJECT_CREATE,
      `Project created: ${project.name}`,
    );

    return project;
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

    const project = await this.prisma.project.update({
      where: {
        id: id,
      },
      data: updateProjectDto,
    });

    if (updateProjectDto.status === 'COMPLETED' && !project.completedAt) {
      await this.prisma.project.update({
        where: { id },
        data: { completedAt: new Date() },
      });
      project.completedAt = new Date();

      await this.logsService.createLog(
        userId,
        LogActionType.PROJECT_COMPLETE,
        `Project completed: ${project.name}`,
      );
    }

    if (updateProjectDto.status !== 'COMPLETED' || project.completedAt) {
      await this.logsService.createLog(
        userId,
        LogActionType.PROJECT_UPDATE,
        `Project updated: ${project.name}`,
      );
    }

    return project;
  }

  async remove(id: number, userId: number) {
    const project = await this.findOne(id, userId);

    await this.prisma.project.update({
      where: {
        id: id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.PROJECT_DELETE,
      `Project deleted: ${project.name}`,
    );

    return { message: 'Projeto deletado com sucesso.' };
  }
}