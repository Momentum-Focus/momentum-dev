import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSupportMessageDTO } from './dtos/create-support-message.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class SupportService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async createSupportMessage(
    userId: number,
    dto: CreateSupportMessageDTO,
  ): Promise<any> {
    const report = await this.prisma.report.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        type: 'PRIORITY',
        status: 'OPEN',
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.USER_PROFILE_UPDATE,
      'Priority support message created',
    );

    return report;
  }
}
