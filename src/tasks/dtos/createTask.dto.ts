import {
  IsString,
  IsBoolean,
  IsOptional,
  IsInt,
  IsNotEmpty,
  IsDate,
  IsUUID,
} from 'class-validator';

export class CreateTaskDTO {
  @IsNotEmpty()
  @IsUUID()
  userId: number;

  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsBoolean()
  isCompleted: boolean;

  @IsNotEmpty()
  @IsDate()
  completedAt: Date;

  @IsOptional()
  @IsInt()
  estimatedDurationMin: number;

  @IsOptional()
  @IsInt()
  estimatedSessions: number;
}
