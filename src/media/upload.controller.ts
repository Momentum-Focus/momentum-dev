import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { UploadService } from './upload.service';
import type { Request as ExpressRequest } from 'express';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: ExpressRequest,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    const userId = (req.user as any)?.id;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado');
    }

    return await this.uploadService.uploadFile(file, userId);
  }

  @Get('user')
  async getUserMedia(@Request() req: ExpressRequest) {
    const userId = (req.user as any)?.id;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado');
    }

    return await this.uploadService.getUserMedia(userId);
  }

  @Delete(':id')
  async deleteMedia(
    @Param('id', ParseIntPipe) mediaId: number,
    @Request() req: ExpressRequest,
  ) {
    const userId = (req.user as any)?.id;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado');
    }

    await this.uploadService.deleteMedia(mediaId, userId);
    return { message: 'Mídia excluída com sucesso' };
  }
}
