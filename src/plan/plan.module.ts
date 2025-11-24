import { Module } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogsService } from 'src/logs/logs.service';

@Module({
  controllers: [PlanController],
  providers: [PlanService, PrismaService, LogsService],
  exports: [PlanService],
})
export class PlanModule {}
