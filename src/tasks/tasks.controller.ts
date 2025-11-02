import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { UpdateTaskDTO } from './dtos/updateTask.dto';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(@Req() req: Request, @Body() createTask: CreateTaskDTO) {
    const userId = req.user!.id;
    return this.tasksService.createTask(createTask, userId);
  }

  @Patch(':id')
  updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTask: UpdateTaskDTO,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;
    return this.tasksService.updateTask(id, updateTask, userId);
  }

  @Get()
  listMyTasks(@Req() req: any) {
    const userId = req.user.id;
    return this.tasksService.findTasks(userId);
  }

  @Get(':id')
  findTaskById(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = req.user!.id;
    return this.tasksService.findTaskById(id, userId);
  }

  @Delete(':id')
  deleteTask(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = req.user!.id;
    return this.tasksService.deleteTask(id, userId);
  }
}