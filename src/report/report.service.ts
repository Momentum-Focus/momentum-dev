import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PlanService } from 'src/plan/plan.service';
import { BasicReportDTO } from './dtos/basic-report.dto';
import { AdvancedReportDTO, InsightDTO } from './dtos/advanced-report.dto';
import {
  OverviewReportDTO,
  PeriodFilter,
  FocusTimeIntervalDTO,
} from './dtos/overview-report.dto';
import {
  InsightsReportDTO,
  EfficiencyDTO,
  SessionBreakdownDTO,
  ProjectVelocityDTO,
  RecommendationDTO,
} from './dtos/insights-report.dto';
import { SessionType } from '@prisma/client';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  format,
} from 'date-fns';
// @ts-ignore - date-fns locale types
import ptBR from 'date-fns/locale/pt-BR';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
  ) {}

  async getBasicReport(userId: number): Promise<BasicReportDTO> {
    // Get last 30 days of daily logs
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate total focus hours
    const totalFocusMinutes = dailyLogs.reduce(
      (sum, log) => sum + log.totalFocusMinutes,
      0,
    );
    const totalFocusHours = Math.round((totalFocusMinutes / 60) * 10) / 10;

    // Focus time per day
    const focusTimePerDay = dailyLogs.map((log) => ({
      date: log.date.toISOString().split('T')[0],
      minutes: log.totalFocusMinutes,
      hours: Math.round((log.totalFocusMinutes / 60) * 10) / 10,
    }));

    // Project distribution
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
          },
        },
      },
    });

    const totalTasks = projects.reduce(
      (sum, project) => sum + project.tasks.length,
      0,
    );

    const projectDistribution = projects.map((project) => {
      const completedTasks = project.tasks.filter(
        (task) => task.isCompleted,
      ).length;
      const percentage =
        totalTasks > 0
          ? Math.round((project.tasks.length / totalTasks) * 100)
          : 0;

      return {
        projectName: project.name,
        taskCount: project.tasks.length,
        completedTasks,
        percentage,
      };
    });

    return {
      totalFocusHours,
      focusTimePerDay,
      projectDistribution,
    };
  }

  async getAdvancedReport(userId: number): Promise<AdvancedReportDTO> {
    const basicReport = await this.getBasicReport(userId);

    // Get last 90 days for advanced analysis
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: ninetyDaysAgo },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Get study sessions for time analysis
    const studySessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        deletedAt: null,
        endedAt: { not: null },
        startedAt: { gte: ninetyDaysAgo },
      },
    });

    // Generate insights
    const insights = this.generateInsights(dailyLogs, studySessions);

    // Weekly trend (last 8 weeks)
    const weeklyTrend = this.calculateWeeklyTrend(dailyLogs);

    // Task completion rate
    const tasks = await this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
      },
    });
    const completedTasks = tasks.filter((task) => task.isCompleted).length;
    const taskCompletionRate =
      tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

    // Average session duration
    const sessionsWithDuration = studySessions.filter(
      (s) => s.durationMinutes && s.durationMinutes > 0,
    );
    const averageSessionDuration =
      sessionsWithDuration.length > 0
        ? Math.round(
            sessionsWithDuration.reduce(
              (sum, s) => sum + (s.durationMinutes || 0),
              0,
            ) / sessionsWithDuration.length,
          )
        : 0;

    return {
      ...basicReport,
      insights,
      weeklyTrend,
      taskCompletionRate,
      averageSessionDuration,
    };
  }

  private generateInsights(
    dailyLogs: any[],
    studySessions: any[],
  ): InsightDTO[] {
    const insights: InsightDTO[] = [];

    // Best day of week
    const dayStats: { [key: number]: number } = {};
    dailyLogs.forEach((log) => {
      const dayOfWeek = log.date.getDay();
      dayStats[dayOfWeek] = (dayStats[dayOfWeek] || 0) + log.totalFocusMinutes;
    });

    const bestDayIndex = Object.keys(dayStats).reduce((a, b) =>
      dayStats[parseInt(a)] > dayStats[parseInt(b)] ? a : b,
    );
    const dayNames = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];
    const bestDay = dayNames[parseInt(bestDayIndex)];

    if (bestDay && dayStats[parseInt(bestDayIndex)] > 0) {
      insights.push({
        type: 'BEST_DAY',
        title: 'Melhor dia da semana',
        description: `Você foca melhor às ${bestDay.toLowerCase()}s`,
        value: bestDay,
      });
    }

    // Best time of day
    const hourStats: { [key: number]: number } = {};
    studySessions.forEach((session) => {
      if (session.startedAt) {
        const hour = new Date(session.startedAt).getHours();
        hourStats[hour] =
          (hourStats[hour] || 0) + (session.durationMinutes || 0);
      }
    });

    if (Object.keys(hourStats).length > 0) {
      const bestHour = Object.keys(hourStats).reduce((a, b) =>
        hourStats[parseInt(a)] > hourStats[parseInt(b)] ? a : b,
      );
      const bestHourNum = parseInt(bestHour);
      const timeLabel = `${bestHourNum}h`;

      insights.push({
        type: 'BEST_TIME',
        title: 'Horário mais produtivo',
        description: `Seu horário de maior produtividade é às ${timeLabel}`,
        value: timeLabel,
      });
    }

    // Productivity trend
    if (dailyLogs.length >= 7) {
      const lastWeek = dailyLogs.slice(-7);
      const previousWeek = dailyLogs.slice(-14, -7);

      const lastWeekTotal = lastWeek.reduce(
        (sum, log) => sum + log.totalFocusMinutes,
        0,
      );
      const previousWeekTotal = previousWeek.reduce(
        (sum, log) => sum + log.totalFocusMinutes,
        0,
      );

      const trend =
        previousWeekTotal > 0
          ? Math.round(
              ((lastWeekTotal - previousWeekTotal) / previousWeekTotal) * 100,
            )
          : 0;

      if (trend > 0) {
        insights.push({
          type: 'PRODUCTIVITY_TREND',
          title: 'Tendência de produtividade',
          description: `Sua produtividade aumentou ${trend}% na última semana`,
          value: `${trend}%`,
        });
      } else if (trend < 0) {
        insights.push({
          type: 'PRODUCTIVITY_TREND',
          title: 'Tendência de produtividade',
          description: `Sua produtividade diminuiu ${Math.abs(trend)}% na última semana`,
          value: `${trend}%`,
        });
      }
    }

    // Task completion rate insight
    const completedSessions = dailyLogs.reduce(
      (sum, log) => sum + log.completedSessions,
      0,
    );
    if (completedSessions > 0) {
      insights.push({
        type: 'TASK_COMPLETION',
        title: 'Sessões completadas',
        description: `Você completou ${completedSessions} sessões de foco nos últimos dias`,
        value: completedSessions.toString(),
      });
    }

    return insights;
  }

  private calculateWeeklyTrend(dailyLogs: any[]): Array<{
    week: string;
    totalMinutes: number;
    averagePerDay: number;
  }> {
    const weeklyData: { [key: string]: number[] } = {};

    dailyLogs.forEach((log) => {
      const date = new Date(log.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = [];
      }
      weeklyData[weekKey].push(log.totalFocusMinutes);
    });

    return Object.keys(weeklyData)
      .sort()
      .slice(-8)
      .map((weekKey) => {
        const minutes = weeklyData[weekKey];
        const totalMinutes = minutes.reduce((sum, m) => sum + m, 0);
        const averagePerDay = Math.round(totalMinutes / minutes.length);

        return {
          week: weekKey,
          totalMinutes,
          averagePerDay,
        };
      });
  }

  // Helper: Calculate date range based on period filter
  private getDateRange(period: PeriodFilter): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = endOfDay(now);

    switch (period) {
      case PeriodFilter.DAY:
        start = startOfDay(now);
        break;
      case PeriodFilter.WEEK:
        start = startOfWeek(now, { locale: ptBR });
        end = endOfWeek(now, { locale: ptBR });
        break;
      case PeriodFilter.MONTH:
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case PeriodFilter.YEAR:
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    return { start, end };
  }

  // Helper: Calculate efficiency (estimated vs actual time)
  private async calculateEfficiency(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<EfficiencyDTO> {
    const completedTasks = await this.prisma.task.findMany({
      where: {
        userId,
        deletedAt: null,
        isCompleted: true,
        completedAt: {
          gte: startDate,
          lte: endDate,
        },
        estimatedDurationMinutes: { not: null },
        actualDurationMinutes: { gt: 0 },
      },
    });

    if (completedTasks.length === 0) {
      return {
        savedMinutes: 0,
        efficiencyRate: 0,
        message: 'Complete tarefas para ver sua eficiência',
      };
    }

    const totalEstimated = completedTasks.reduce(
      (sum, task) => sum + (task.estimatedDurationMinutes || 0),
      0,
    );
    const totalActual = completedTasks.reduce(
      (sum, task) => sum + task.actualDurationMinutes,
      0,
    );

    const savedMinutes = totalEstimated - totalActual;
    const efficiencyRate =
      totalEstimated > 0
        ? Math.round((savedMinutes / totalEstimated) * 100)
        : 0;

    let message: string;
    if (savedMinutes > 0) {
      const hours = Math.floor(savedMinutes / 60);
      const minutes = savedMinutes % 60;
      if (hours > 0) {
        message = `Você economizou ${hours}h${minutes > 0 ? ` e ${minutes}min` : ''}!`;
      } else {
        message = `Você economizou ${minutes}min!`;
      }
    } else if (savedMinutes < 0) {
      const overMinutes = Math.abs(savedMinutes);
      const hours = Math.floor(overMinutes / 60);
      const minutes = overMinutes % 60;
      if (hours > 0) {
        message = `Tarefas levaram ${hours}h${minutes > 0 ? ` e ${minutes}min` : ''} a mais que o estimado`;
      } else {
        message = `Tarefas levaram ${minutes}min a mais que o estimado`;
      }
    } else {
      message = 'Você está no prazo estimado!';
    }

    return {
      savedMinutes,
      efficiencyRate,
      message,
    };
  }

  // New endpoint: GET /reports/overview
  async getOverviewReport(
    userId: number,
    period: PeriodFilter = PeriodFilter.MONTH,
  ): Promise<OverviewReportDTO> {
    const { start, end } = this.getDateRange(period);

    // Get daily logs in range
    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId,
        deletedAt: null,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Calculate totals
    const totalFocusMinutes = dailyLogs.reduce(
      (sum, log) => sum + log.totalFocusMinutes,
      0,
    );
    const totalFocusHours = Math.round((totalFocusMinutes / 60) * 10) / 10;

    const tasksCompleted = dailyLogs.reduce(
      (sum, log) => sum + log.tasksCompleted,
      0,
    );

    // Get active projects
    const activeProjects = await this.prisma.project.count({
      where: {
        userId,
        deletedAt: null,
      },
    });

    // Focus time per interval (grouped by period)
    const focusTimePerInterval: FocusTimeIntervalDTO[] = [];

    if (period === PeriodFilter.DAY) {
      // Group by hour
      const hourStats: { [key: number]: number } = {};
      const studySessions = await this.prisma.studySession.findMany({
        where: {
          userId,
          deletedAt: null,
          startedAt: { gte: start, lte: end },
          typeSession: SessionType.FOCUS,
        },
      });

      studySessions.forEach((session) => {
        if (session.startedAt) {
          const hour = new Date(session.startedAt).getHours();
          hourStats[hour] =
            (hourStats[hour] || 0) + (session.durationMinutes || 0);
        }
      });

      Object.keys(hourStats)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach((hour) => {
          const minutes = hourStats[parseInt(hour)];
          focusTimePerInterval.push({
            date: `${hour}h`,
            minutes,
            hours: Math.round((minutes / 60) * 10) / 10,
          });
        });
    } else {
      // Group by day
      dailyLogs.forEach((log) => {
        focusTimePerInterval.push({
          date: format(new Date(log.date), 'dd/MM', { locale: ptBR }),
          minutes: log.totalFocusMinutes,
          hours: Math.round((log.totalFocusMinutes / 60) * 10) / 10,
        });
      });
    }

    // Project distribution
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
            completedAt:
              period === PeriodFilter.DAY
                ? { gte: start, lte: end }
                : period === PeriodFilter.WEEK
                  ? { gte: start, lte: end }
                  : period === PeriodFilter.MONTH
                    ? { gte: start, lte: end }
                    : { gte: start, lte: end },
          },
        },
      },
    });

    const totalTasks = projects.reduce(
      (sum, project) => sum + project.tasks.length,
      0,
    );

    const projectDistribution = projects
      .filter((project) => project.tasks.length > 0)
      .map((project) => {
        const completedTasks = project.tasks.filter(
          (task) => task.isCompleted,
        ).length;
        const percentage =
          totalTasks > 0
            ? Math.round((project.tasks.length / totalTasks) * 100)
            : 0;

        return {
          projectName: project.name,
          taskCount: project.tasks.length,
          completedTasks,
          percentage,
        };
      });

    return {
      totalFocusHours,
      tasksCompleted,
      activeProjects,
      focusTimePerInterval,
      projectDistribution,
    };
  }

  // New endpoint: GET /reports/insights (Epic Only)
  async getInsightsReport(
    userId: number,
    period: PeriodFilter = PeriodFilter.WEEK,
  ): Promise<InsightsReportDTO> {
    const overview = await this.getOverviewReport(userId, period);
    const { start, end } = this.getDateRange(period);

    // Calculate efficiency
    const efficiency = await this.calculateEfficiency(userId, start, end);

    // Session breakdown
    const studySessions = await this.prisma.studySession.findMany({
      where: {
        userId,
        deletedAt: null,
        startedAt: { gte: start, lte: end },
        endedAt: { not: null },
      },
    });

    const sessionBreakdown: SessionBreakdownDTO = {
      focusSessions: studySessions.filter(
        (s) => s.typeSession === SessionType.FOCUS,
      ).length,
      shortBreakSessions: studySessions.filter(
        (s) => s.typeSession === SessionType.SHORT_BREAK,
      ).length,
      longBreakSessions: studySessions.filter(
        (s) => s.typeSession === SessionType.LONG_BREAK,
      ).length,
    };

    // Project velocity
    const projects = await this.prisma.project.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        tasks: {
          where: {
            deletedAt: null,
            isCompleted: true,
            completedAt: { gte: start, lte: end },
            actualDurationMinutes: { gt: 0 },
          },
        },
      },
    });

    const projectVelocity: ProjectVelocityDTO[] = projects
      .filter((project) => project.tasks.length > 0)
      .map((project) => {
        const totalTime = project.tasks.reduce(
          (sum, task) => sum + task.actualDurationMinutes,
          0,
        );
        const averageTimePerTask =
          project.tasks.length > 0
            ? Math.round(totalTime / project.tasks.length)
            : 0;

        return {
          projectName: project.name,
          tasksCompleted: project.tasks.length,
          averageTimePerTask,
        };
      });

    // Generate recommendations
    const recommendations = await this.generateRecommendations(
      userId,
      start,
      end,
      studySessions,
      efficiency,
    );

    return {
      ...overview,
      efficiency,
      sessionBreakdown,
      projectVelocity,
      recommendations,
    };
  }

  private async generateRecommendations(
    userId: number,
    start: Date,
    end: Date,
    studySessions: any[],
    efficiency: EfficiencyDTO,
  ): Promise<RecommendationDTO[]> {
    const recommendations: RecommendationDTO[] = [];

    // Morning person detection
    const morningSessions = studySessions.filter((s) => {
      if (!s.startedAt) return false;
      const hour = new Date(s.startedAt).getHours();
      return hour >= 6 && hour < 12;
    });
    const totalSessions = studySessions.length;
    if (totalSessions > 0 && morningSessions.length / totalSessions > 0.5) {
      recommendations.push({
        type: 'MORNING_PERSON',
        title: 'Você é uma pessoa matutina',
        description:
          'Agende tarefas difíceis antes das 12h para maximizar sua produtividade.',
        icon: '🌅',
      });
    }

    // Break ratio analysis
    const focusSessions = studySessions.filter(
      (s) => s.typeSession === SessionType.FOCUS,
    );
    const breakSessions = studySessions.filter(
      (s) =>
        s.typeSession === SessionType.SHORT_BREAK ||
        s.typeSession === SessionType.LONG_BREAK,
    );
    if (
      focusSessions.length > 0 &&
      breakSessions.length / focusSessions.length < 0.3
    ) {
      recommendations.push({
        type: 'BREAK_RATIO',
        title: 'Você está pulando pausas',
        description:
          'Risco de burnout detectado. Tente fazer mais pausas entre sessões de foco.',
        icon: '⚠️',
      });
    }

    // Efficiency recommendation
    if (efficiency.efficiencyRate > 10) {
      recommendations.push({
        type: 'EFFICIENCY',
        title: 'Excelente eficiência!',
        description: efficiency.message,
        icon: '⚡',
      });
    } else if (efficiency.efficiencyRate < -10) {
      recommendations.push({
        type: 'EFFICIENCY',
        title: 'Tarefas estão levando mais tempo',
        description:
          'Tente quebrar tarefas em partes menores para melhorar as estimativas.',
        icon: '📊',
      });
    }

    // Best day recommendation
    const dailyLogs = await this.prisma.dailyLog.findMany({
      where: {
        userId,
        deletedAt: null,
        date: { gte: start, lte: end },
      },
    });

    if (dailyLogs.length >= 7) {
      const dayStats: { [key: number]: number } = {};
      dailyLogs.forEach((log) => {
        const dayOfWeek = new Date(log.date).getDay();
        dayStats[dayOfWeek] =
          (dayStats[dayOfWeek] || 0) + log.totalFocusMinutes;
      });

      const bestDays = Object.keys(dayStats)
        .map((day) => ({
          day: parseInt(day),
          minutes: dayStats[parseInt(day)],
        }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 2);

      if (bestDays.length > 0 && bestDays[0].minutes > 0) {
        const dayNames = [
          'Domingo',
          'Segunda',
          'Terça',
          'Quarta',
          'Quinta',
          'Sexta',
          'Sábado',
        ];
        const bestDayNames = bestDays.map((d) => dayNames[d.day]);
        recommendations.push({
          type: 'BEST_DAY',
          title: 'Pico de Produtividade',
          description: `Seus melhores dias são ${bestDayNames.join(' e ')}. Agende tarefas importantes nesses dias.`,
          icon: '📈',
        });
      }
    }

    return recommendations;
  }
}
