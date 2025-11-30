import { Module } from '@nestjs/common';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { LogsModule } from 'src/logs/logs.module';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports: [PrismaModule, LogsModule, PlanModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
