import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports: [PlanModule],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectModule {}
