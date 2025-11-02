import { SessionType } from '@prisma/client';
import { IsOptional, IsInt, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateStudySessionDTO {
  @IsOptional()
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsInt()
  durationMinutes?: number;

  @IsNotEmpty()
  @IsEnum(SessionType)
  typeSession: SessionType;
}
