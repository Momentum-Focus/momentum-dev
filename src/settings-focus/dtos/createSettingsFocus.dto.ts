import { IsInt, IsOptional, Min } from 'class-validator';

export class CreateSettingsFocusDTO {
  @IsInt()
  @Min(1)
  @IsOptional()
  focusDurationMinutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  shortBreakDurationMinutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  longBreakDurationMinutes?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  cyclesBeforeLongBreak?: number;
}