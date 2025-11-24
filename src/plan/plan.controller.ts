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
    const subscription = await this.planService.getUserSubscription(
      req.user.id,
    );

    // Se não há subscription, retornar plano VIBES (gratuito)
    if (!subscription) {
      const allPlans = await this.planService.getActivePlans();
      const vibesPlan = allPlans.find((p) => p.name === 'VIBES');

      if (vibesPlan) {
        return {
          plan: {
            name: vibesPlan.name,
            features: vibesPlan.features,
          },
        };
      }

      // Fallback: retornar null se VIBES não existir
      return { plan: null };
    }

    return {
      plan: {
        name: subscription.plan.name,
        features: subscription.plan.features,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  async subscribe(@Request() req: any, @Body() dto: SubscribePlanDto) {
    return await this.planService.subscribeUserToPlan(req.user.id, dto.planId);
  }
}
