export interface ICreateTask {
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: Date;
  idUser: string;
  createdAt: Date;
  updatedAt: Date;
  estimatedDurationMinutes?: number;
  estimatedSessions?: number;
}

export interface IUpdateTask {
  title?: string;
  description?: string;
  isCompleted?: boolean;
  completedAt?: Date;
  idUser?: string;
  createdAt?: Date;
  updatedAt?: Date;
  estimatedDurationMinutes?: number;
  estimatedSessions?: number;
}
