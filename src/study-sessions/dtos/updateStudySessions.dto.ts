import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateStudySessionDTO } from './createStudySessions.dto';
import { IsOptional, IsDate } from 'class-validator';

export class UpdateStudySessionDTO extends PartialType(
  OmitType(CreateStudySessionDTO, ['userId']),
) {
  @IsOptional()
  @IsDate()
  endedAt?: Date;
}
