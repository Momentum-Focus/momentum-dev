import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Task, Prisma, LogActionType } from '@prisma/client';
import { UpdateTaskDTO } from './dtos/updateTask.dto';
import { LogsService } from 'src/logs/logs.service';
import { AchievementsService } from 'src/achievements/achievements.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
    private achievementsService: AchievementsService,
  ) {}

  async createTask(
    createTaskDto: CreateTaskDTO,
    userId: number,
  ): Promise<Task | null> {
    // TODO: Implementar validação de projeto quando ProjectModule estiver pronto
    // if (createTaskDto.projectId) {
    //   const project = await this.prisma.project.findFirst({
    //     where: {
    //       id: createTaskDto.projectId,
    //       userId: userId,
    //       deletedAt: null,
    //     },
    //   });

    //   if (!project) {
    //     throw new ForbiddenException(
    //       'Projeto não encontrado ou não pertence a este usuário.',
    //     );
    //   }
    // }

    const task = await this.prisma.task.create({
      data: {
        ...createTaskDto,
        userId: userId,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.TASK_CREATE,
      `Task created: ${task.title}`,
    );

    const { createdAt, updatedAt, deletedAt, ...dataTask } = task;
    return dataTask as Task;
  }

  async updateTask(
    id: number,
    updateTask: UpdateTaskDTO,
    userId: number,
  ): Promise<Task | null> {
    await this.findTaskById(id, userId);

    const data: Prisma.TaskUpdateInput = { ...updateTask };

    if (updateTask.isCompleted === true) {
      data.completedAt = new Date();
    } else if (updateTask.isCompleted === false) {
      data.completedAt = null;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: data,
    });

    if (updateTask.isCompleted === true) {
      await this.logsService.createLog(
        userId,
        LogActionType.TASK_COMPLETE,
        `Task completed: ${updatedTask.title}`,
      );
      await this.achievementsService.checkAndGrantAchievements(userId);
    }

    if (updateTask.isCompleted !== true) {
      await this.logsService.createLog(
        userId,
        LogActionType.TASK_UPDATE,
        `Task updated: ${updatedTask.title}`,
      );
    }

    const { createdAt, updatedAt, deletedAt, ...dataTask } = updatedTask;
    return dataTask as Task;
  }

  async findTasks(userId: number): Promise<any[]> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, deletedAt: null },
      include: {
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                userId: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    if (tasks.length === 0) {
      return [];
    }

    return tasks.map((task) => {
      const { createdAt, updatedAt, deletedAt, tags, project, ...dataTask } =
        task;
      const formattedTags = tags.map((tagTask: any) => tagTask.tag);
      return {
        ...dataTask,
        tags: formattedTags,
        project: project
          ? {
              id: project.id,
              name: project.name,
              color: project.color,
            }
          : null,
      };
    });
  }

  async findTaskById(id: number, userId: number): Promise<any> {
    const task = await this.prisma.task.findFirst({
      where: { id, userId: userId, deletedAt: null },
      include: {
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Tarefa não encontrada ou você não tem permissão para acessá-la.',
      );
    }

    const { deletedAt, tags, ...dataTask } = task;
    const formattedTags = tags.map((tagTask: any) => tagTask.tag);
    return {
      ...dataTask,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      tags: formattedTags,
    };
  }

  async deleteTask(id: number, userId: number): Promise<{ message: string }> {
    const task = await this.findTaskById(id, userId);

    if (!task) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.TASK_DELETE,
      `Task deleted: ${task.title}`,
    );

    return { message: 'Tarefa deletada com sucesso.' };
  }
}
