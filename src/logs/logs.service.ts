import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  async createLog(
    userId: number | null,
    action: LogActionType,
    details?: string,
  ): Promise<void> {
    try {
      await this.prisma.logActivity.create({
        data: {
          userId,
          action,
          details,
        },
      });
    } catch (error) {
      console.error('Erro ao criar log:', error);
    }
  }
}
