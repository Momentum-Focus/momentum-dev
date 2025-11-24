import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '../decorators/feature.decorator';
import { PlanService } from 'src/plan/plan.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private planService: PlanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures =
      this.reflector.get<string[]>(FEATURES_KEY, context.getHandler()) ?? [];

    if (requiredFeatures.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const subscription = await this.planService.getUserSubscription(userId);
    if (!subscription?.plan) {
      throw new ForbiddenException('Faça upgrade para acessar este recurso.');
    }

    const featureCodes = subscription.plan.features.map(
      (planFeature) => planFeature.feature.code,
    );

    const missingFeature = requiredFeatures.find(
      (feature) => !featureCodes.includes(feature),
    );

    if (missingFeature) {
      throw new ForbiddenException(
        'Faça upgrade para o Momentum Pro e desbloqueie este recurso.',
      );
    }

    request.userFeatures = featureCodes;
    return true;
  }
}


