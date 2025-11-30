import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { PlanModule } from 'src/plan/plan.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PlanModule, PrismaModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
