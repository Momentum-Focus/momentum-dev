import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
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
import { FocusSoundsService } from './focus-sounds.service';
import type { Request as ExpressRequest } from 'express';
import { multerConfig } from './multer.config';

@Controller('media')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly focusSoundsService: FocusSoundsService,
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
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
  @UseGuards(JwtAuthGuard)
  async getUserMedia(@Request() req: ExpressRequest) {
    const userId = (req.user as any)?.id;

    if (!userId) {
      throw new BadRequestException('Usuário não autenticado');
    }

    return await this.uploadService.getUserMedia(userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
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

  @Post('focus-sounds/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadFocusSound(
    @UploadedFile() file: Express.Multer.File,
    @Body('soundType') soundType: string,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    if (
      !soundType ||
      !['rain', 'ocean', 'fireplace', 'lofi'].includes(soundType)
    ) {
      throw new BadRequestException(
        'Tipo de som inválido. Use: rain, ocean, fireplace ou lofi',
      );
    }

    return await this.focusSoundsService.uploadFocusSound(
      file,
      soundType as 'rain' | 'ocean' | 'fireplace' | 'lofi',
    );
  }

  @Get('focus-sounds/urls')
  async getFocusSoundUrls() {
    return await this.focusSoundsService.getFocusSoundUrls();
  }

  @Get('preset-backgrounds/urls')
  async getPresetBackgroundUrls() {
    return await this.uploadService.getPresetBackgroundUrls();
  }
}
