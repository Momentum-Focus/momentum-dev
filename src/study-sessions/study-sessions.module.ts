import { Module } from '@nestjs/common';
import { StudySessionsController } from './study-sessions.controller';
import { StudySessionsService } from './study-sessions.service';
import { AchievementsModule } from 'src/achievements/achievements.module';
import { PlanModule } from 'src/plan/plan.module';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [AchievementsModule, PlanModule, PrismaModule],
  controllers: [StudySessionsController],
  providers: [StudySessionsService],
  exports: [StudySessionsService],
})
export class StudySessionsModule {}
