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

    // Verifica cada feature requerida usando método otimizado
    for (const featureCode of requiredFeatures) {
      const hasFeature = await this.planService.userHasFeature(
        userId,
        featureCode,
      );

      if (!hasFeature) {
        throw new ForbiddenException(
          `Esta funcionalidade requer o plano que inclui: ${featureCode}. Faça upgrade para desbloquear.`,
        );
      }
    }

    return true;
  }
}
