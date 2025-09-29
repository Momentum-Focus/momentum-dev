import { Controller, Get, Query } from '@nestjs/common';
import { RoleService } from './role.service';

@Controller('role')
export class RoleController {
    constructor(private readonly roleService: RoleService) {}

    @Get()
    findRole(@Query('name') name: string) {
        return this.roleService.findRole(name) 
    }
}
