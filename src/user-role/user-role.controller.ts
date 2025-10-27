import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/auth/roles/role.enum';
import { Roles } from 'src/auth/roles/roles.decorator';
import { RolesGuard } from 'src/auth/roles/roles.guard';
import { RegisterUserRoleDTO } from './dtos/registerUserRole.dto';
import { UserRoleService } from './user-role.service';
import { UpdateUserRoleDTO } from './dtos/updateUserRole.dto';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';

@Controller('user-role')
export class UserRoleController {
  constructor(private readonly userRoleService: UserRoleService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() registerUserRole: RegisterUserRoleDTO) {
    return this.userRoleService.create(registerUserRole);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('me')
  update(@Req() req: any, @Body() updateUserRole: UpdateUserRoleDTO) {
    const userRoleId = req.userRole.id;

    return this.userRoleService.updateUserRole(userRoleId, updateUserRole);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  listUsers() {
    return this.userRoleService.findUserRole;
  }
}
