import { PartialType } from '@nestjs/mapped-types';
import { CreateSettingsFocusDTO } from './createSettingsFocus.dto';

export class UpdateSettingsFocusDTO extends PartialType(
  CreateSettingsFocusDTO,
) {}