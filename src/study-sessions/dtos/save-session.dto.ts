import { SessionType } from '@prisma/client';
import {
  IsInt,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
} from 'class-validator';

export class SaveSessionDto {
  @IsInt()
  @Min(0)
  durationMinutes: number; // Time actually focused

  @IsNotEmpty()
  @IsEnum(SessionType)
  type: SessionType; // FOCUS, SHORT_BREAK, LONG_BREAK

  @IsBoolean()
  completed: boolean; // true if timer reached 0, false if reset/stopped

  @IsOptional()
  @IsInt()
  taskId?: number; // Optional linked task
}
