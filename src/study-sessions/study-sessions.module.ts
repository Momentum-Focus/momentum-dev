import { Module } from '@nestjs/common';
import { StudySessionsController } from './study-sessions.controller';
import { StudySessionsService } from './study-sessions.service';

@Module({
  controllers: [StudySessionsController],
  providers: [StudySessionsService]
})
export class StudySessionsModule {}
