import { PartialType } from '@nestjs/mapped-types';
import { RegisterUserRoleDTO } from './registerUserRole.dto';

export class UpdateUserRoleDTO extends PartialType(RegisterUserRoleDTO) {}
