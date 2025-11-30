import { IsInt, IsOptional, Min, IsString, Matches } from 'class-validator';

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

  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'themeColor must be a valid hex color',
  })
  @IsOptional()
  themeColor?: string;
}
