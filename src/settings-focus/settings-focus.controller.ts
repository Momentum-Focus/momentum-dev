import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { SettingsFocusService } from './settings-focus.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { CreateSettingsFocusDTO } from './dtos/createSettingsFocus.dto';

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
}
