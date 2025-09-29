import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDTO } from './dtos/registerUser.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  register(@Body() registerUser: RegisterUserDTO) {
    return this.userService.create(registerUser)
  }
}
