import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @UseGuards(JwtAuthGuard)
  @Post('me')
  create(@Body() createTask: CreateTaskDTO) {
    return this.tasksService.createTask(createTask);
  }


}
