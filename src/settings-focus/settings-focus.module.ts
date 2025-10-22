import { Module } from '@nestjs/common';
import { SettingsFocusController } from './settings-focus.controller';
import { SettingsFocusService } from './settings-focus.service';

@Module({
  controllers: [SettingsFocusController],
  providers: [SettingsFocusService]
})
export class SettingsFocusModule {}
