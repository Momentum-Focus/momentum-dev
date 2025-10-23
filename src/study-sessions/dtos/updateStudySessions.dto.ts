import { PartialType } from '@nestjs/mapped-types';
import { CreateStudySessionDTO } from "./createStudySessions.dto";

export class UpdateStudySessionDTO extends PartialType(CreateStudySessionDTO) {

}