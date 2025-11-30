import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDTO } from './dtos/create-project.dto';
import { UpdateProjectDTO } from './dtos/update-project.dto';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { RequireFeatures } from 'src/auth/decorators/feature.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@UseGuards(JwtAuthGuard)
@Controller('project')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PROJECTS')
  create(@Body() createProjectDto: CreateProjectDTO, @Req() req: any) {
    const userId = req.user.id;
    return this.projectService.create(createProjectDto, userId);
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PROJECTS')
  findAll(@Req() req: any) {
    const userId = req.user.id;
    return this.projectService.findAll(userId);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PROJECTS')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.projectService.findOne(id, userId);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PROJECTS')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProjectDto: UpdateProjectDTO,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    return this.projectService.update(id, updateProjectDto, userId);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PROJECTS')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.id;
    return this.projectService.remove(id, userId);
  }
}
