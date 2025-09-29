import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  providers: [UserService, PrismaModule],
  controllers: [UserController]
})
export class UserModule {}
