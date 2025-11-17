import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Tag } from '@prisma/client';
import { CreateTagDTO } from './dtos/create-tag.dto';
import { UpdateTagDTO } from './dtos/update-tag.dto';
import { LogsService } from 'src/logs/logs.service';
import { LogActionType } from '@prisma/client';

@Injectable()
export class TagsService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async create(userId: number, createTagDTO: CreateTagDTO): Promise<Tag> {
    const tag = await this.prisma.tag.create({
      data: {
        ...createTagDTO,
        userId,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.TAG_CREATE,
      `Tag created: ${tag.name}`,
    );

    return tag;
  }

  async findAll(userId: number): Promise<Tag[]> {
    return await this.prisma.tag.findMany({
      where: {
        userId,
      },
    });
  }

  async findOne(userId: number, id: number): Promise<Tag> {
    const tag = await this.prisma.tag.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag não encontrada');
    }

    return tag;
  }

  async update(
    userId: number,
    id: number,
    updateTagDTO: UpdateTagDTO,
  ): Promise<Tag> {
    await this.findOne(userId, id);

    const tag = await this.prisma.tag.update({
      where: { id },
      data: updateTagDTO,
    });

    await this.logsService.createLog(
      userId,
      LogActionType.TAG_UPDATE,
      `Tag updated: ${tag.name}`,
    );

    return tag;
  }

  async remove(userId: number, id: number): Promise<void> {
    const tag = await this.findOne(userId, id);

    await this.prisma.tag.delete({
      where: { id },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.TAG_DELETE,
      `Tag deleted: ${tag.name}`,
    );
  }

  async addTagToTask(userId: number, taskId: number, tagId: number): Promise<void> {
    await this.findOne(userId, tagId);

    await this.prisma.tagTask.create({
      data: {
        tagId,
        taskId,
      },
    });
  }

  async removeTagFromTask(userId: number, taskId: number, tagId: number): Promise<void> {
    await this.findOne(userId, tagId);

    await this.prisma.tagTask.deleteMany({
      where: {
        tagId,
        taskId,
      },
    });
  }
}

