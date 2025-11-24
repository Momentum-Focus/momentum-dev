import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Comment } from '@prisma/client';
import { CreateCommentDTO } from './dtos/create-comment.dto';
import { UpdateCommentDTO } from './dtos/update-comment.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async create(userId: number, createCommentDTO: CreateCommentDTO): Promise<Comment> {
    if (!createCommentDTO.taskId && !createCommentDTO.projectId) {
      throw new BadRequestException('taskId ou projectId deve ser fornecido');
    }

    if (createCommentDTO.taskId && createCommentDTO.projectId) {
      throw new BadRequestException('Apenas taskId ou projectId deve ser fornecido');
    }

    const comment = await this.prisma.comment.create({
      data: {
        ...createCommentDTO,
        userId,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.COMMENT_CREATE,
      `Comment created on ${createCommentDTO.taskId ? 'task' : 'project'}`,
    );

    return comment;
  }

  async findAll(userId: number, taskId?: number, projectId?: number): Promise<Comment[]> {
    const where: any = {
      userId,
      deletedAt: null,
    };

    if (taskId) {
      where.taskId = taskId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    return await this.prisma.comment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: number, id: number): Promise<Comment> {
    const comment = await this.prisma.comment.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comentário não encontrado');
    }

    return comment;
  }

  async update(
    userId: number,
    id: number,
    updateCommentDTO: UpdateCommentDTO,
  ): Promise<Comment> {
    await this.findOne(userId, id);

    return await this.prisma.comment.update({
      where: { id },
      data: updateCommentDTO,
    });
  }

  async remove(userId: number, id: number): Promise<void> {
    await this.findOne(userId, id);

    await this.prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.COMMENT_DELETE,
      `Comment deleted: ${id}`,
    );
  }
}

