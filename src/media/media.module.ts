import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { UserModule } from 'src/user/user.module';
import { SpotifyOAuthStrategy } from './strategy/spotify.strategy';
import { GoogleYouTubeStrategy } from './strategy/google-youtube.strategy';
import { YouTubeService } from './youtube.service';
import { LogsModule } from 'src/logs/logs.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    UserModule,
    LogsModule,
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    SpotifyOAuthStrategy,
    GoogleYouTubeStrategy,
    YouTubeService,
  ],
  exports: [MediaService, YouTubeService],
})
export class MediaModule {}
