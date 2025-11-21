import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports: [PrismaModule, PlanModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}

