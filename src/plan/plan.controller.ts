import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PlanService } from './plan.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { SubscribePlanDto } from './dtos/subscribe-plan.dto';

@Controller('plans')
export class PlanController {
  constructor(private planService: PlanService) {}

  @Get()
  async getPlans() {
    return await this.planService.getActivePlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMyPlan(@Request() req: any) {
    return await this.planService.getUserSubscription(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(@Request() req: any, @Body() dto: SubscribePlanDto) {
    return await this.planService.subscribeUserToPlan(req.user.id, dto.planId);
  }
}
