import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDTO } from './dtos/updateUser.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Patch()
  update(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateUser: UpdateUserDTO,
  ) {
    return this.userService.update(userId, updateUser);
  }

  @Get()
  listUsers() {
    return this.userService.listUsers();
  }

  @Get()
  findById(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.findUserByID(userId);
  }

  @Delete()
  delete(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.delete(userId);
  }
}
