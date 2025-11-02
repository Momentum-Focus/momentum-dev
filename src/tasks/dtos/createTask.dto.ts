import { TaskPriority } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsEnum,
  Length,
} from 'class-validator';

export class CreateTaskDTO {
  @IsOptional()
  @IsInt()
  projectId?: number;

  @IsNotEmpty()
  @IsString()
  @Length(3, 100)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsInt()
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  estimatedSessions?: number;
}