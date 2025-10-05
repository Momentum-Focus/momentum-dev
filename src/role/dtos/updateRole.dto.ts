import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDTO } from './createRole.dto';

export class UpdateRoleDTO extends PartialType(CreateRoleDTO) {}
