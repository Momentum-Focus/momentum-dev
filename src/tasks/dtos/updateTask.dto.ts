import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDTO } from './createTask.dto';

export class UpdateTaskDTO extends PartialType(CreateTaskDTO) {
  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}
