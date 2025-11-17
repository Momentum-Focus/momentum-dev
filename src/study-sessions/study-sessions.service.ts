import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudySessionDTO } from './dtos/createStudySessions.dto';
import { UpdateStudySessionDTO } from './dtos/updateStudySessions.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StudySession } from '@prisma/client';

@Injectable()
export class StudySessionsService {
  constructor(private prisma: PrismaService) {}

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
    await this.findStudySessionById(id, userId);

    const updatedStudySession = await this.prisma.studySession.update({
      where: { id },
      data: { ...updateStudySession },
    });

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
}
