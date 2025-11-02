import { SessionType } from '@prisma/client';
import { IsOptional, IsInt, IsNotEmpty, IsEnum } from 'class-validator';

export class CreateStudySessionDTO {
  @IsNotEmpty()
  @IsInt()
  userId: number;

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
