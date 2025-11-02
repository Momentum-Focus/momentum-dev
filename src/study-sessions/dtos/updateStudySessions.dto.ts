import { PartialType } from '@nestjs/mapped-types';
import { CreateStudySessionDTO } from './createStudySessions.dto';
import { IsOptional, IsDate } from 'class-validator';

export class UpdateStudySessionDTO extends PartialType(CreateStudySessionDTO) {
  @IsOptional()
  @IsDate()
  endedAt?: Date;
}
