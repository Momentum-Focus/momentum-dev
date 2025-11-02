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

@Controller('study-sessions')
export class StudySessionsController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('me')
  createStudySession(
    @Req() req: Request,
    @Body() createStudySession: CreateStudySessionDTO,
  ) {
    const userId = req.user!.id;

    return this.studySessionsService.createStudySession({
      ...createStudySession,
      userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  updateStudySession(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudySession: UpdateStudySessionDTO,
  ) {
    return this.studySessionsService.updateStudySession(id, updateStudySession);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMyStudySessions(@Req() req: any) {
    const userId = req.user.id;
    return this.studySessionsService.findStudySessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findStudySessionById(@Param('id', ParseIntPipe) id: number) {
    return this.studySessionsService.findStudySessionById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteStudySession(@Param('id', ParseIntPipe) id: number) {
    return this.studySessionsService.deleteStudySession(id);
  }
}
