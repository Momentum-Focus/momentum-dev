import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Task } from '@prisma/client';
import { UserService } from 'src/user/user.service';
import { UpdateTaskDTO } from './dtos/updateTask.dto';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async createTask(createTask: CreateTaskDTO): Promise<Task | null> {
    const user = await this.userService.findUserByID(createTask.userId);

    if (!user)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const task = this.prisma.task.create({
      data: {
        ...createTask,
      },
    });

    return task;
  }

  async updateTask(
    id: number,
    updateTask: UpdateTaskDTO,
  ): Promise<Task | null> {
    await this.findTaskById(id);

    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: { ...updateTask },
    });

    const { createdAt, updatedAt, deletedAt, ...dataTask } = updatedTask;

    return dataTask as Task;
  }

  async findTasks(userId: number): Promise<Task[] | []> {
    const tasks = await this.prisma.task.findMany({
      where: { userId, deletedAt: null },
    });

    return tasks.map((task) => {
      const { createdAt, updatedAt, deletedAt, ...dataTask } = task;

      return dataTask as Task;
    });
  }

  async findTaskById(id: number): Promise<Task | null> {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
    });

    if (!task)
      throw new NotFoundException('ID Inválido!', {
        cause: new Error(),
        description: 'Task não encontrada, atualize o id e tente novamente.',
      });

    const { createdAt, updatedAt, deletedAt, ...dataTask } = task;

    return dataTask as Task;
  }

  async deleteTask(id: number): Promise<{ message: string }> {
    await this.findTaskById(id);

    await this.prisma.task.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return {message: 'Task deletado com sucesso.'};
  }
}
