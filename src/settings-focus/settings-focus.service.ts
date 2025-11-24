import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSettingsFocusDTO } from './dtos/createSettingsFocus.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class SettingsFocusService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async getSettings(userId: number) {
    const settings = await this.prisma.settingsFocus.findUnique({
      where: { userId },
    });

    if (settings) {
      return settings;
    }

    return await this.prisma.settingsFocus.create({
      data: {
        userId,
      },
    });
  }

  async saveSettings(userId: number, dto: CreateSettingsFocusDTO) {
    const settings = await this.prisma.settingsFocus.upsert({
      where: { userId },
      update: {
        ...dto,
      },
      create: {
        userId,
        ...dto,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.SETTINGS_UPDATE,
      'Focus settings updated',
    );

    return settings;
  }
}
