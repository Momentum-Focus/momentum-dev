import { Module } from '@nestjs/common';
import { StudySessionsController } from './study-sessions.controller';
import { StudySessionsService } from './study-sessions.service';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [UserModule],
  controllers: [StudySessionsController],
  providers: [StudySessionsService],
  exports: [StudySessionsService],
})
export class StudySessionsModule {}
