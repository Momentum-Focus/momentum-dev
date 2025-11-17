import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TasksModule } from './tasks/tasks.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RoleModule } from './role/role.module';
import { UserRoleModule } from './user-role/user-role.module';
import { DailyLogsModule } from './daily-logs/daily-logs.module';
import { SettingsFocusModule } from './settings-focus/settings-focus.module';
import { StudySessionsModule } from './study-sessions/study-sessions.module';
import { LogsModule } from './logs/logs.module';
import { ReportModule } from './report/report.module';
import { ProjectModule } from './project/project.module';
import { NotificationModule } from './notification/notification.module';
import { PlanModule } from './plan/plan.module';
import { MediaModule } from './media/media.module';
import { TagsModule } from './tags/tags.module';
import { CommentsModule } from './comments/comments.module';
import { AchievementsModule } from './achievements/achievements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TasksModule,
    UserModule,
    AuthModule,
    RoleModule,
    UserRoleModule,
    DailyLogsModule,
    SettingsFocusModule,
    StudySessionsModule,
    LogsModule,
    ReportModule,
    ProjectModule,
    NotificationModule,
    PlanModule,
    MediaModule,
    TagsModule,
    CommentsModule,
    AchievementsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
