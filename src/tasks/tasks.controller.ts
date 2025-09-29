import { Body, Controller, Post } from '@nestjs/common';
import { CreateTaskDTO } from './dtos/createTask.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(@Body() createTask: CreateTaskDTO) {
    return this.tasksService.create(createTask);
  }
}
