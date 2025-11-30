import { IsArray, IsNumber, IsString, IsOptional } from 'class-validator';
import { OverviewReportDTO } from './overview-report.dto';

export class EfficiencyDTO {
  @IsNumber()
  savedMinutes: number;

  @IsNumber()
  efficiencyRate: number; // Percentage (e.g., 15 means 15% faster)

  @IsString()
  message: string;
}

export class SessionBreakdownDTO {
  @IsNumber()
  focusSessions: number;

  @IsNumber()
  shortBreakSessions: number;

  @IsNumber()
  longBreakSessions: number;
}

export class ProjectVelocityDTO {
  @IsString()
  projectName: string;

  @IsNumber()
  tasksCompleted: number;

  @IsNumber()
  averageTimePerTask: number; // in minutes
}

export class RecommendationDTO {
  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  icon?: string;
}

export class InsightsReportDTO extends OverviewReportDTO {
  @IsNumber()
  efficiency: EfficiencyDTO;

  @IsNumber()
  sessionBreakdown: SessionBreakdownDTO;

  @IsArray()
  projectVelocity: ProjectVelocityDTO[];

  @IsArray()
  recommendations: RecommendationDTO[];
}

