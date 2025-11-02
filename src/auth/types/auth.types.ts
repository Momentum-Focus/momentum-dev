import { User as PrismaUser } from '@prisma/client';

export type AuthenticatedUser = Omit<PrismaUser, 'passwordHash'>;

declare global {
  namespace Express {
    export interface User extends AuthenticatedUser {}

    export interface Request {
      user?: User;
    }
  }
}