import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDTO } from './dtos/create-comment.dto';
import { UpdateCommentDTO } from './dtos/update-comment.dto';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Request() req: any, @Body() createCommentDTO: CreateCommentDTO) {
    return this.commentsService.create(req.user.id, createCommentDTO);
  }

  @Get()
  findAll(
    @Request() req: any,
    @Query('taskId') taskId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.commentsService.findAll(
      req.user.id,
      taskId ? +taskId : undefined,
      projectId ? +projectId : undefined,
    );
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.findOne(req.user.id, +id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateCommentDTO: UpdateCommentDTO,
  ) {
    return this.commentsService.update(req.user.id, +id, updateCommentDTO);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.commentsService.remove(req.user.id, +id);
  }
}

