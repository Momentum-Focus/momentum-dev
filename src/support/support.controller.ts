import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequireFeatures } from 'src/auth/decorators/feature.decorator';
import { CreateSupportMessageDTO } from './dtos/create-support-message.dto';

@Controller('support')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('message')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('PRIORITY_SUPPORT')
  async createSupportMessage(
    @Request() req: any,
    @Body() dto: CreateSupportMessageDTO,
  ) {
    return await this.supportService.createSupportMessage(req.user.id, dto);
  }
}
