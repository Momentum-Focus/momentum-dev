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
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { CreateTagDTO } from './dtos/create-tag.dto';
import { UpdateTagDTO } from './dtos/update-tag.dto';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Post()
  create(@Request() req: any, @Body() createTagDTO: CreateTagDTO) {
    return this.tagsService.create(req.user.id, createTagDTO);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.tagsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.tagsService.findOne(req.user.id, +id);
  }

  @Patch(':id')
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateTagDTO: UpdateTagDTO,
  ) {
    return this.tagsService.update(req.user.id, +id, updateTagDTO);
  }

  @Delete(':id')
  remove(@Request() req: any, @Param('id') id: string) {
    return this.tagsService.remove(req.user.id, +id);
  }

  @Post(':tagId/tasks/:taskId')
  addTagToTask(
    @Request() req: any,
    @Param('tagId') tagId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tagsService.addTagToTask(req.user.id, +taskId, +tagId);
  }

  @Delete(':tagId/tasks/:taskId')
  removeTagFromTask(
    @Request() req: any,
    @Param('tagId') tagId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tagsService.removeTagFromTask(req.user.id, +taskId, +tagId);
  }
}

