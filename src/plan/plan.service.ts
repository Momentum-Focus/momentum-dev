import { Injectable, NotFoundException } from '@nestjs/common';
import {
  SubscriptionStatus,
  LogActionType,
  Plan,
  Feature,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { LogsService } from 'src/logs/logs.service';

@Injectable()
export class PlanService {
  constructor(
    private prisma: PrismaService,
    private logsService: LogsService,
  ) {}

  async getActivePlans(): Promise<
    Array<
      Plan & {
        features: Array<{
          feature: Feature;
        }>;
      }
    >
  > {
    return await this.prisma.plan.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        features: {
          include: {
            feature: true,
          },
        },
      },
      orderBy: {
        price: 'asc',
      },
    });
  }

  async getUserSubscription(userId: number) {
    return await this.prisma.subscription.findFirst({
      where: { userId, deletedAt: null },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
            },
          },
        },
      },
    });
  }

  async subscribeUserToPlan(userId: number, planId: number) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true, deletedAt: null },
    });

    if (!plan) {
      throw new NotFoundException('Plano não encontrado');
    }

    const now = new Date();
    await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        updatedAt: now,
        deletedAt: null,
      },
      create: {
        userId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
      },
    });

    await this.logsService.createLog(
      userId,
      LogActionType.USER_PROFILE_UPDATE,
      `Subscription updated to ${plan.name}`,
    );

    return await this.getUserSubscription(userId);
  }

  async userHasFeature(userId: number, featureCode: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription?.plan) {
      return false;
    }

    return subscription.plan.features.some(
      (planFeature) => planFeature.feature.code === featureCode,
    );
  }
}
