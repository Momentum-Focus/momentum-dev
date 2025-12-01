import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { FocusSoundsService } from './focus-sounds.service';
import { UserModule } from 'src/user/user.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SpotifyOAuthStrategy } from './strategy/spotify.strategy';
import { GoogleYouTubeStrategy } from './strategy/google-youtube.strategy';
import { YouTubeService } from './youtube.service';
import { LogsModule } from 'src/logs/logs.module';
import { PlanModule } from 'src/plan/plan.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    UserModule,
    PrismaModule,
    LogsModule,
    PlanModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MediaController, UploadController],
  providers: [
    MediaService,
    UploadService,
    FocusSoundsService,
    SpotifyOAuthStrategy,
    GoogleYouTubeStrategy,
    YouTubeService,
  ],
  exports: [MediaService, UploadService, YouTubeService],
})
export class MediaModule {}
