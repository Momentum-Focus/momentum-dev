import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudySessionDTO } from './dtos/createStudySessions.dto';
import { UpdateStudySessionDTO } from './dtos/updateStudySessions.dto';
import { SaveSessionDto } from './dtos/save-session.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StudySession, SessionType } from '@prisma/client';
import { AchievementsService } from 'src/achievements/achievements.service';

@Injectable()
export class StudySessionsService {
  constructor(
    private prisma: PrismaService,
    private achievementsService: AchievementsService,
  ) {}

  async createStudySession(
    createStudySession: CreateStudySessionDTO,
    userId: number,
  ): Promise<StudySession | null> {
    const studySession = await this.prisma.studySession.create({
      data: {
        userId,
        startedAt: new Date(),
        taskId: createStudySession.taskId,
        durationMinutes: createStudySession.durationMinutes,
        typeSession: createStudySession.typeSession,
      },
    });

    const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
      studySession;

    return dataStudySession as StudySession;
  }

  async updateStudySession(
    id: number,
    updateStudySession: UpdateStudySessionDTO,
    userId: number,
  ): Promise<StudySession | null> {
    const existingSession = await this.findStudySessionById(id, userId);

    if (!existingSession) {
      throw new NotFoundException('Sessão de estudo não encontrada');
    }

    const updatedStudySession = await this.prisma.studySession.update({
      where: { id },
      data: { ...updateStudySession },
    });

    // Verificar conquistas quando uma sessão é finalizada (endedAt é definido e não existia antes)
    if (updateStudySession.endedAt && !existingSession.endedAt) {
      await this.achievementsService.checkAndGrantAchievements(userId);
    }

    const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
      updatedStudySession;

    return dataStudySession as StudySession;
  }

  async findStudySessions(userId: number): Promise<StudySession[] | []> {
    const studySessions = await this.prisma.studySession.findMany({
      where: { userId, deletedAt: null },
    });

    return studySessions.map((studySession) => {
      const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
        studySession;

      return dataStudySession as StudySession;
    });
  }

  async findStudySessionsHistory(userId: number): Promise<any[]> {
    const studySessions = await this.prisma.studySession.findMany({
      where: { userId, deletedAt: null, endedAt: { not: null } },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: 100, // Limita a 100 sessões mais recentes
    });

    return studySessions.map((studySession) => {
      const { createdAt, updatedAt, deletedAt, task, ...dataStudySession } =
        studySession;

      return {
        ...dataStudySession,
        taskTitle: task?.title || null,
        taskId: task?.id || null,
      };
    });
  }

  async findStudySessionById(
    id: number,
    userId: number,
  ): Promise<StudySession | null> {
    const studySession = await this.prisma.studySession.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!studySession)
      throw new NotFoundException('ID Inválido!', {
        cause: new Error(),
        description:
          'Sessão de estudo não encontrada, atualize o id e tente novamente.',
      });

    const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
      studySession;

    return dataStudySession as StudySession;
  }

  async deleteStudySession(
    id: number,
    userId: number,
  ): Promise<{ message: string }> {
    await this.findStudySessionById(id, userId);

    await this.prisma.studySession.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Sessão de estudo deletada com sucesso.' };
  }

  async saveSession(
    userId: number,
    dto: SaveSessionDto,
  ): Promise<{ studySession: StudySession; dailyLog: any }> {
    // 1. Create StudySession
    const studySession = await this.prisma.studySession.create({
      data: {
        userId,
        startedAt: new Date(),
        endedAt: new Date(),
        durationMinutes: dto.durationMinutes,
        typeSession: dto.type,
        taskId: dto.taskId,
      },
    });

    // 2. Upsert DailyLog
    // Get today's date (YYYY-MM-DD format)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayDateOnly = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const existingDailyLog = await this.prisma.dailyLog.findFirst({
      where: {
        userId,
        date: todayDateOnly,
        deletedAt: null,
      },
    });

    let dailyLog;

    // Prepare update/create data
    const updateData: any = {};
    const createData: any = {
      userId,
      date: todayDateOnly,
      totalFocusMinutes: 0,
      totalPauseMinutes: 0,
      tasksCompleted: 0,
      completedSessions: 0,
    };

    // Handle FOCUS sessions
    if (dto.type === SessionType.FOCUS) {
      if (existingDailyLog) {
        updateData.totalFocusMinutes = {
          increment: dto.durationMinutes,
        };
      } else {
        createData.totalFocusMinutes = dto.durationMinutes;
      }

      // Increment completedSessions if completed
      if (dto.completed) {
        if (existingDailyLog) {
          updateData.completedSessions = {
            increment: 1,
          };
        } else {
          createData.completedSessions = 1;
        }
      }
    }

    // Handle BREAK sessions
    if (
      dto.type === SessionType.SHORT_BREAK ||
      dto.type === SessionType.LONG_BREAK
    ) {
      if (existingDailyLog) {
        updateData.totalPauseMinutes = {
          increment: dto.durationMinutes,
        };
      } else {
        createData.totalPauseMinutes = dto.durationMinutes;
      }
    }

    // Update or create DailyLog
    if (existingDailyLog) {
      if (Object.keys(updateData).length > 0) {
        dailyLog = await this.prisma.dailyLog.update({
          where: { id: existingDailyLog.id },
          data: updateData,
        });
      } else {
        dailyLog = existingDailyLog;
      }
    } else {
      dailyLog = await this.prisma.dailyLog.create({
        data: createData,
      });
    }

    // Update task actualDurationMinutes if taskId is provided and type is FOCUS
    if (dto.taskId && dto.type === SessionType.FOCUS) {
      await this.prisma.task.update({
        where: { id: dto.taskId },
        data: {
          actualDurationMinutes: {
            increment: dto.durationMinutes,
          },
        },
      });
    }

    // 5. Check achievements when a session is completed
    if (dto.completed && dto.type === SessionType.FOCUS) {
      await this.achievementsService.checkAndGrantAchievements(userId);
    }

    const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
      studySession;

    return {
      studySession: dataStudySession as StudySession,
      dailyLog,
    };
  }
}

