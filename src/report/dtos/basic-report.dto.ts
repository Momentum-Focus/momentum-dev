export class BasicReportDTO {
  totalFocusHours: number;
  focusTimePerDay: Array<{
    date: string;
    minutes: number;
    hours: number;
  }>;
  projectDistribution: Array<{
    projectName: string;
    taskCount: number;
    completedTasks: number;
    percentage: number;
  }>;
}
