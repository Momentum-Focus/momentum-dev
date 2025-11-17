import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType, AchievementCode } from '@prisma/client';

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async checkAndGrantAchievements(userId: number): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tasks: {
          where: { isCompleted: true, deletedAt: null },
        },
        projects: {
          where: { status: 'COMPLETED', deletedAt: null },
        },
        studySessions: {
          where: { deletedAt: null },
        },
        dailyLogs: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
        },
        achievements: {
          include: {
            achievement: true,
          },
        },
      },
    });

    if (!user) {
      return;
    }

    const completedTasksCount = user.tasks.length;
    const completedProjectsCount = user.projects.length;
    const totalFocusMinutes = user.studySessions.reduce(
      (sum, session) => sum + (session.durationMinutes || 0),
      0,
    );

    const streak = await this.calculateStreak(user.dailyLogs);
    const earnedAchievementCodes = new Set(
      user.achievements.map((ua) => ua.achievement.code),
    );

    await this.checkStreakAchievements(userId, streak, earnedAchievementCodes);
    await this.checkTaskAchievements(userId, completedTasksCount, earnedAchievementCodes);
    await this.checkProjectAchievements(
      userId,
      completedProjectsCount,
      earnedAchievementCodes,
    );
    await this.checkFocusAchievements(userId, totalFocusMinutes, earnedAchievementCodes);
  }

  private async calculateStreak(dailyLogs: any[]): Promise<number> {
    if (dailyLogs.length === 0) {
      return 0;
    }

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dailyLogs.length; i++) {
      const logDate = new Date(dailyLogs[i].date);
      logDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);

      if (
        logDate.getTime() === expectedDate.getTime() &&
        (dailyLogs[i].tasksCompleted > 0 || dailyLogs[i].totalFocusMinutes > 0)
      ) {
        streak++;
        continue;
      }

      break;
    }

    return streak;
  }

  private async checkStreakAchievements(
    userId: number,
    streak: number,
    earnedCodes: Set<AchievementCode>,
  ): Promise<void> {
    if (streak >= 3 && !earnedCodes.has(AchievementCode.STREAK_3_DAYS)) {
      await this.grantAchievement(userId, AchievementCode.STREAK_3_DAYS);
    }

    if (streak >= 7 && !earnedCodes.has(AchievementCode.STREAK_7_DAYS)) {
      await this.grantAchievement(userId, AchievementCode.STREAK_7_DAYS);
    }

    if (streak >= 30 && !earnedCodes.has(AchievementCode.STREAK_30_DAYS)) {
      await this.grantAchievement(userId, AchievementCode.STREAK_30_DAYS);
    }
  }

  private async checkTaskAchievements(
    userId: number,
    completedTasksCount: number,
    earnedCodes: Set<AchievementCode>,
  ): Promise<void> {
    if (completedTasksCount >= 1 && !earnedCodes.has(AchievementCode.FIRST_TASK_COMPLETED)) {
      await this.grantAchievement(userId, AchievementCode.FIRST_TASK_COMPLETED);
    }

    if (completedTasksCount >= 10 && !earnedCodes.has(AchievementCode.TASKS_10_COMPLETED)) {
      await this.grantAchievement(userId, AchievementCode.TASKS_10_COMPLETED);
    }

    if (completedTasksCount >= 100 && !earnedCodes.has(AchievementCode.TASKS_100_COMPLETED)) {
      await this.grantAchievement(userId, AchievementCode.TASKS_100_COMPLETED);
    }
  }

  private async checkProjectAchievements(
    userId: number,
    completedProjectsCount: number,
    earnedCodes: Set<AchievementCode>,
  ): Promise<void> {
    if (
      completedProjectsCount >= 1 &&
      !earnedCodes.has(AchievementCode.FIRST_PROJECT_COMPLETED)
    ) {
      await this.grantAchievement(userId, AchievementCode.FIRST_PROJECT_COMPLETED);
    }
  }

  private async checkFocusAchievements(
    userId: number,
    totalFocusMinutes: number,
    earnedCodes: Set<AchievementCode>,
  ): Promise<void> {
    const totalHours = totalFocusMinutes / 60;

    if (totalHours >= 10 && !earnedCodes.has(AchievementCode.FOCUS_10_HOURS)) {
      await this.grantAchievement(userId, AchievementCode.FOCUS_10_HOURS);
    }

    if (totalHours >= 100 && !earnedCodes.has(AchievementCode.FOCUS_100_HOURS)) {
      await this.grantAchievement(userId, AchievementCode.FOCUS_100_HOURS);
    }
  }

  private async grantAchievement(
    userId: number,
    achievementCode: AchievementCode,
  ): Promise<void> {
    const achievement = await this.prisma.achievement.findUnique({
      where: { code: achievementCode },
    });

    if (!achievement) {
      return;
    }

    await this.prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.ACHIEVEMENT_EARNED,
      `Achievement earned: ${achievement.name}`,
    );
  }

  async getUserAchievements(userId: number) {
    return await this.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });
  }

  async getAllAchievements() {
    return await this.prisma.achievement.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }
}

