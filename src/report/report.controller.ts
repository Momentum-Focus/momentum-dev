import {
  Controller,
  Get,
  Req,
  UseGuards,
  Query,
  ParseEnumPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { JwtAuthGuard } from 'src/auth/strategy/jwt-auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequireFeatures } from 'src/auth/decorators/feature.decorator';
import { PlanService } from 'src/plan/plan.service';
import { PeriodFilter } from './dtos/overview-report.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard)
@Controller('report')
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly planService: PlanService,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequireFeatures('BASIC_REPORTS')
  async getReport(@Req() req: Request) {
    const userId = req.user!.id;

    // Check if user has advanced insights feature
    const hasAdvancedInsights = await this.planService.userHasFeature(
      userId,
      'ADVANCED_INSIGHTS',
    );

    if (hasAdvancedInsights) {
      return this.reportService.getAdvancedReport(userId);
    }

    return this.reportService.getBasicReport(userId);
  }

  @Get('overview')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('BASIC_REPORTS')
  async getOverview(
    @Req() req: Request,
    @Query('period', new ParseEnumPipe(PeriodFilter, { optional: true }))
    period?: PeriodFilter,
  ) {
    const userId = req.user!.id;
    // Flow users can only use MONTH or YEAR
    const hasAdvancedInsights = await this.planService.userHasFeature(
      userId,
      'ADVANCED_INSIGHTS',
    );

    if (
      !hasAdvancedInsights &&
      period &&
      period !== PeriodFilter.MONTH &&
      period !== PeriodFilter.YEAR
    ) {
      // Default to MONTH for Flow users
      period = PeriodFilter.MONTH;
    }

    return this.reportService.getOverviewReport(
      userId,
      period || PeriodFilter.MONTH,
    );
  }

  @Get('insights')
  @UseGuards(PermissionsGuard)
  @RequireFeatures('BASIC_REPORTS') // Basic check, we'll do advanced check manually
  async getInsights(
    @Req() req: Request,
    @Query('period', new ParseEnumPipe(PeriodFilter, { optional: true }))
    period?: PeriodFilter,
  ) {
    const userId = req.user!.id;

    // Check if user has ADVANCED_INSIGHTS, ADVANCED_REPORTS, or is EPIC
    const hasAdvancedInsights = await this.planService.userHasFeature(
      userId,
      'ADVANCED_INSIGHTS',
    );
    const hasAdvancedReports = await this.planService.userHasFeature(
      userId,
      'ADVANCED_REPORTS',
    );

    // Get user's subscription to check if EPIC
    const subscription = await this.planService.getUserSubscription(userId);
    const isEpic = subscription?.plan?.name?.toUpperCase() === 'EPIC';

    if (!hasAdvancedInsights && !hasAdvancedReports && !isEpic) {
      throw new ForbiddenException(
        'Esta funcionalidade requer o plano Epic ou a feature ADVANCED_INSIGHTS/ADVANCED_REPORTS.',
      );
    }

    return this.reportService.getInsightsReport(
      userId,
      period || PeriodFilter.WEEK,
    );
  }
}
