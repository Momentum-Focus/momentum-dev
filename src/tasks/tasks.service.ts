import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { Task } from '@prisma/client';
import { UserService } from 'src/user/user.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async create(createTask: CreateTaskDTO): Promise<Task | null> {
    const user = await this.userService.findUserByID(createTask.userId);

    if (!user)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const task = this.prisma.task.create({ data: {
      ...createTask
    } });

    return task;
  }
}
