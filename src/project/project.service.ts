import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProjectDTO } from './dtos/create-project.dto';
import { UpdateProjectDTO } from './dtos/update-project.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';
import { PlanService } from 'src/plan/plan.service';
import { AchievementsService } from 'src/achievements/achievements.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
    private planService: PlanService,
    private achievementsService: AchievementsService,
  ) {}

  async create(createProjectDto: CreateProjectDTO, userId: number) {
    const [projectCount, hasProjectsFeature] = await Promise.all([
      this.prisma.project.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
      this.planService.userHasFeature(userId, 'PROJECTS'),
    ]);

    // Se o usuário tem a feature PROJECTS (Flow ou Epic), não há limite
    // Se não tem (Vibes), limite de 3 projetos
    if (!hasProjectsFeature && projectCount >= 3) {
      throw new ForbiddenException(
        'Alcance do plano Vibes atingido. Faça upgrade para Flow ou Epic para criar projetos ilimitados.',
      );
    }

    // Converte dueDate de string para Date se fornecido
    const dueDate = createProjectDto.dueDate
      ? new Date(createProjectDto.dueDate)
      : null;

    // Valida se a data é válida
    if (dueDate && isNaN(dueDate.getTime())) {
      throw new BadRequestException('Data de vencimento inválida.');
    }

    // Define cor padrão como azul se não fornecida
    const color = createProjectDto.color || '#3B82F6';

    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        description: createProjectDto.description || null,
        color: color,
        dueDate: dueDate,
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
    const projects = await this.prisma.project.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Mais antigos primeiro
      },
    });

    // Calcula o progresso de cada projeto baseado nas tasks completadas
    return projects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter(
        (task) => task.isCompleted,
      ).length;
      const progress =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const { tasks, ...projectData } = project;
      return {
        ...projectData,
        progress,
        totalTasks,
        completedTasks,
      };
    });
  }

  async findOne(id: number, userId: number) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: id,
        userId: userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
          },
          include: {
            tags: {
              include: {
                tag: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!project) {
      throw new NotFoundException(
        'Projeto não encontrado ou você não tem permissão para acessá-lo.',
      );
    }

    // Formata as tasks para incluir tags formatadas
    const formattedTasks = project.tasks.map((task) => {
      const { tags, ...taskData } = task;
      const formattedTags = tags.map((tagTask: any) => tagTask.tag);
      return { ...taskData, tags: formattedTags };
    });

    return {
      ...project,
      tasks: formattedTasks,
    };
  }

  async update(id: number, updateProjectDto: UpdateProjectDTO, userId: number) {
    await this.findOne(id, userId);

    // Prepara os dados para atualização
    const updateData: any = {};

    if (updateProjectDto.name !== undefined) {
      updateData.name = updateProjectDto.name;
    }

    if (updateProjectDto.description !== undefined) {
      updateData.description = updateProjectDto.description || null;
    }

    if (updateProjectDto.color !== undefined) {
      updateData.color = updateProjectDto.color || '#3B82F6';
    }

    if (updateProjectDto.dueDate !== undefined) {
      if (updateProjectDto.dueDate) {
        const dueDate = new Date(updateProjectDto.dueDate);
        if (isNaN(dueDate.getTime())) {
          throw new BadRequestException('Data de vencimento inválida.');
        }
        updateData.dueDate = dueDate;
      } else {
        updateData.dueDate = null;
      }
    }

    if (updateProjectDto.status !== undefined) {
      updateData.status = updateProjectDto.status;
    }

    const project = await this.prisma.project.update({
      where: {
        id: id,
      },
      data: updateData,
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
      await this.achievementsService.checkAndGrantAchievements(userId);
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
