import { TaskPriority } from '@prisma/client';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsEnum,
  IsDate,
} from 'class-validator';

export class CreateTaskDTO {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  projectId?: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsBoolean()
  isCompleted: boolean;

  @IsNotEmpty()
  @IsDate()
  completedAt: Date;

  @IsOptional()
  @IsInt()
  estimatedDurationMinutes?: number;

  @IsOptional()
  @IsInt()
  estimatedSessions?: number;
}
