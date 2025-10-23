import { SessionType } from '@prisma/client';
import {
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsDate,
  IsEnum,
} from 'class-validator';

export class CreateStudySessionDTO {
  @IsNotEmpty()
  @IsInt()
  userId: number;

  @IsOptional()
  @IsInt()
  taskId?: number;

  @IsNotEmpty()
  @IsDate()
  startedAt: Date;

  @IsOptional()
  @IsDate()
  endedAt?: Date;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsNotEmpty()
  @IsEnum(SessionType)
  typeSession: SessionType;
}
