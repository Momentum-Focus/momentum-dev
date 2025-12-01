import { IsArray, IsNumber, IsString, IsEnum } from 'class-validator';

export enum PeriodFilter {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export class FocusTimeIntervalDTO {
  @IsString()
  date: string;

  @IsNumber()
  minutes: number;

  @IsNumber()
  hours: number;
}

export class ProjectDistributionDTO {
  @IsString()
  projectName: string;

  @IsNumber()
  taskCount: number;

  @IsNumber()
  completedTasks: number;

  @IsNumber()
  percentage: number;
}

export class OverviewReportDTO {
  @IsNumber()
  totalFocusHours: number;

  @IsNumber()
  tasksCompleted: number;

  @IsNumber()
  activeProjects: number;

  @IsArray()
  focusTimePerInterval: FocusTimeIntervalDTO[];

  @IsArray()
  projectDistribution: ProjectDistributionDTO[];
}


