import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PlanModule } from 'src/plan/plan.module';
import { AchievementsModule } from 'src/achievements/achievements.module';

@Module({
  imports: [PlanModule, AchievementsModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
