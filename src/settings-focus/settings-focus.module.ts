import { Module } from '@nestjs/common';
import { SettingsFocusController } from './settings-focus.controller';
import { SettingsFocusService } from './settings-focus.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LogsModule } from 'src/logs/logs.module';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports: [PrismaModule, LogsModule, PlanModule],
  controllers: [SettingsFocusController],
  providers: [SettingsFocusService],
  exports: [SettingsFocusService],
})
export class SettingsFocusModule {}
