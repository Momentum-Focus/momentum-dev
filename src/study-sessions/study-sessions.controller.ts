import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateStudySessionDTO } from './dtos/createStudySessions.dto';
import { UpdateStudySessionDTO } from './dtos/updateStudySessions.dto';
import { StudySessionsService } from './study-sessions.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('study-sessions')
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @Post()
  createStudySession(
    @Req() req: Request,
    @Body() createStudySession: CreateStudySessionDTO,
  ) {
    const userId = req.user!.id;

    return this.studySessionsService.createStudySession(
      createStudySession,
      userId,
    );
  }

  @Patch(':id')
  updateStudySession(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudySession: UpdateStudySessionDTO,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;

    return this.studySessionsService.updateStudySession(
      id,
      updateStudySession,
      userId,
    );
  }

  @Get()
  listStudySessions(@Req() req: any) {
    const userId = req.user.id;
    return this.studySessionsService.findStudySessions(userId);
  }

  @Get(':id')
  findStudySessionById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;

    return this.studySessionsService.findStudySessionById(id, userId);
  }

  @Delete(':id')
  deleteStudySession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const userId = req.user!.id;

    return this.studySessionsService.deleteStudySession(id, userId);
  }
}
