import {
  Body,
  Controller,
  Get,
  Put,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SettingsFocusService } from './settings-focus.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequireFeatures } from 'src/auth/decorators/feature.decorator';
import { CreateSettingsFocusDTO } from './dtos/createSettingsFocus.dto';
import { IsString, Matches } from 'class-validator';

class UpdateThemeDTO {
  @IsString()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'themeColor must be a valid hex color',
  })
  themeColor: string;
}

@Controller('settings-focus')
@UseGuards(JwtAuthGuard)
export class SettingsFocusController {
  constructor(private settingsFocusService: SettingsFocusService) {}

  @Get()
  async getSettings(@Request() req: any) {
    return await this.settingsFocusService.getSettings(req.user.id);
  }

  @Put()
  async saveSettings(@Request() req: any, @Body() dto: CreateSettingsFocusDTO) {
    return await this.settingsFocusService.saveSettings(req.user.id, dto);
  }

  @Patch('theme')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('FULL_CUSTOMIZATION')
  async updateTheme(@Request() req: any, @Body() dto: UpdateThemeDTO) {
    return await this.settingsFocusService.saveSettings(req.user.id, {
      themeColor: dto.themeColor,
    });
  }
}
