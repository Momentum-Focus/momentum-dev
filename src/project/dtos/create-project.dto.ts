import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsHexColor,
  Length,
} from 'class-validator';

export class CreateProjectDTO {
  @IsString()
  @IsNotEmpty()
  @Length(3, 100)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: Date;

  @IsHexColor()
  @IsOptional()
  color?: string;
}