import { Module } from '@nestjs/common';
import { TimerController } from './timer.controller';
import { StudySessionsModule } from 'src/study-sessions/study-sessions.module';

@Module({
  imports: [StudySessionsModule],
  controllers: [TimerController],
})
export class TimerModule {}
