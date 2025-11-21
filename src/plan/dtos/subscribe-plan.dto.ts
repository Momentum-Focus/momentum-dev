import { IsInt, Min } from 'class-validator';

export class SubscribePlanDto {
  @IsInt()
  @Min(1)
  planId: number;
}


