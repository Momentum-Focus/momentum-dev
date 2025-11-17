import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDTO } from './dtos/updateUser.dto';
import { UpdateProfileDTO } from './dtos/updateProfile.dto';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { Roles } from 'src/auth/roles/roles.decorator';
import { Role } from 'src/auth/roles/role.enum';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}


  @Get()
  getMe(@Req() req: Request) {
    const userProfile = req.user;
    if (!userProfile) {
      throw new UnauthorizedException('Usuário não autenticado', {
        cause: new Error(),
        description: 'Usuário não autenticado, faça login para continuar.',
      });
    }

    const { password, createdAt, updatedAt, deletedAt, ...userProfileData } =
      userProfile;

    return userProfileData;
  }

  @Patch()
  update(@Req() req: Request, @Body() updateUser: UpdateUserDTO) {
    const userId = req.user!.id;

    return this.userService.update(userId, updateUser);
  }

  @Patch('profile')
  updateProfile(
    @Req() req: Request,
    @Body() updateProfileDTO: UpdateProfileDTO,
  ) {
    const userId = req.user!.id;

    return this.userService.updateProfile(userId, updateProfileDTO);
  }

  @Patch('complete-profile')
  completeProfile(
    @Req() req: Request,
    @Body() updateData: { phone?: string; cpf?: string },
  ) {
    const userId = req.user!.id;

    return this.userService.updateProfileWithCpf(userId, updateData);
  }

  @Delete()
  deleteMyAccount(@Req() req: Request) {
    const userId = req.user!.id;

    return this.userService.deleteMyAccount(userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('all')
  listUsers() {
    return this.userService.listUsers();
  }
}
