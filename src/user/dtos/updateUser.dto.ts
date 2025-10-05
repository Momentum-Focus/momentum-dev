import { PartialType } from '@nestjs/mapped-types';
import { RegisterUserDTO } from './registerUser.dto';

export class UpdateUserDTO extends PartialType(RegisterUserDTO) {}
