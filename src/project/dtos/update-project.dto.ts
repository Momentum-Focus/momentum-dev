import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsEnum } from 'class-validator';
import { CreateProjectDTO } from './create-project.dto';
import { ProjectStatus } from '@prisma/client';

export class UpdateProjectDTO extends PartialType(CreateProjectDTO) {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}