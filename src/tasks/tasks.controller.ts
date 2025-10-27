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

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @UseGuards(JwtAuthGuard)
  @Post('me')
  createTask(@Req() req: Request, @Body() createTask: CreateTaskDTO) {
    const userId = req.user!.id;

    return this.tasksService.createTask({ ...createTask, userId });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTask: UpdateTaskDTO,
  ) {
    return this.tasksService.updateTask(id, updateTask);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMyTasks(@Req() req: any) {
    const userId = req.user.id;
    return this.tasksService.findTasks(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findTaskById(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.findTaskById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteTask(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.deleteTask(id);
  }
}
