import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { Roles } from 'src/auth/roles/roles.decorator';
import { Role } from 'src/auth/roles/role.enum';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import type { Request } from 'express';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  update(@Req() req: any, @Body() updateUser: UpdateUserDTO) {
    const userId = req.user.id;

    return this.userService.update(userId, updateUser);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  listUsers() {
    return this.userService.listUsers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  detailProfile(@Req() req: any) {
    const userProfile = req.user;

    const {
      password,
      createdAt,
      updatedAt,
      deletedAt,
      roles,
      ...userProfileData
    } = userProfile;

    return userProfileData;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteMyAccount(@Req() req: any) {
    const userId = req.user.id;

    return this.userService.deleteMyAccount(userId);
  }
}
