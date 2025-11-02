import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudySessionDTO } from './dtos/createStudySessions.dto';
import { UpdateStudySessionDTO } from './dtos/updateStudySessions.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { StudySession } from '@prisma/client';
import { UserService } from 'src/user/user.service';

@Injectable()
export class StudySessionsService {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
  ) {}

  async createStudySession(
    createStudySession: CreateStudySessionDTO,
  ): Promise<StudySession | null> {
    const user = await this.userService.findUserByID(createStudySession.userId);

    if (!user)
      throw new NotFoundException('ID inválido!', {
        cause: new Error(),
        description: 'Nenhum usuario encontrado com esse ID, insira outro',
      });

    const studySession = await this.prisma.studySession.create({
      data: {
        ...createStudySession,
        startedAt: new Date(),
      },
    });

    const { createdAt, updatedAt, deletedAt, ...dataStudySession } =
      studySession;

    return dataStudySession as StudySession;
  }

  async updateStudySession(
    id: number,
    updateStudySession: UpdateStudySessionDTO,
  ): Promise<StudySession | null> {
    await this.findStudySessionById(id);

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

  async findStudySessionById(id: number): Promise<StudySession | null> {
    const studySession = await this.prisma.studySession.findFirst({
      where: { id, deletedAt: null },
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

  async deleteStudySession(id: number): Promise<{ message: string }> {
    await this.findStudySessionById(id);

    await this.prisma.studySession.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Sessão de estudo deletada com sucesso.' };
  }
}
