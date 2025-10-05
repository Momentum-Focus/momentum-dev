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
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { Roles } from 'src/auth/roles/roles.decorator';
import { Role } from 'src/auth/roles/role.enum';

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
  detailProfile(@Req() req: Request) {
    const userProfile = req.user;

    delete userProfile.password;

    return userProfile;
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  deleteMyAccount(@Req() req: any) {
    const userId = req.user.id;

    return this.userService.deleteMyAccount(userId);
  }
}
