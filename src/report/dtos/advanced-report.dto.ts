import { BasicReportDTO } from './basic-report.dto';

export class InsightDTO {
  type: 'BEST_DAY' | 'BEST_TIME' | 'PRODUCTIVITY_TREND' | 'TASK_COMPLETION';
  title: string;
  description: string;
  value?: string | number;
}

export class AdvancedReportDTO extends BasicReportDTO {
  insights: InsightDTO[];
  weeklyTrend: Array<{
    week: string;
    totalMinutes: number;
    averagePerDay: number;
  }>;
  taskCompletionRate: number;
  averageSessionDuration: number;
}
