import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { SaveSessionDto } from 'src/study-sessions/dtos/save-session.dto';
import { StudySessionsService } from 'src/study-sessions/study-sessions.service';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('timer')
export class TimerController {
  constructor(private readonly studySessionsService: StudySessionsService) {}

  @Post('session')
  saveSession(@Req() req: Request, @Body() dto: SaveSessionDto) {
    const userId = req.user!.id;
    return this.studySessionsService.saveSession(userId, dto);
  }
}
