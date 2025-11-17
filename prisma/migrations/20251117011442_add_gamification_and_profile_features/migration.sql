/*
  Warnings:

  - A unique constraint covering the columns `[cpf]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."CommentType" AS ENUM ('PROJECT', 'TASK');

-- CreateEnum
CREATE TYPE "public"."AchievementCode" AS ENUM ('STREAK_3_DAYS', 'STREAK_7_DAYS', 'STREAK_30_DAYS', 'FIRST_TASK_COMPLETED', 'TASKS_10_COMPLETED', 'TASKS_100_COMPLETED', 'FIRST_PROJECT_COMPLETED', 'FOCUS_10_HOURS', 'FOCUS_100_HOURS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."LogActionType" ADD VALUE 'USER_LOGIN_SUCCESS';
ALTER TYPE "public"."LogActionType" ADD VALUE 'USER_LOGIN_FAILED';
ALTER TYPE "public"."LogActionType" ADD VALUE 'USER_DELETE_ACCOUNT';
ALTER TYPE "public"."LogActionType" ADD VALUE 'PROJECT_CREATE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'PROJECT_UPDATE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'PROJECT_DELETE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'PROJECT_COMPLETE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'TAG_CREATE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'TAG_UPDATE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'TAG_DELETE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'COMMENT_CREATE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'COMMENT_DELETE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'ACHIEVEMENT_EARNED';
ALTER TYPE "public"."LogActionType" ADD VALUE 'MEDIA_CONNECT_SPOTIFY';
ALTER TYPE "public"."LogActionType" ADD VALUE 'MEDIA_CONNECT_GOOGLE';
ALTER TYPE "public"."LogActionType" ADD VALUE 'GENERIC_ERROR';

-- DropForeignKey
ALTER TABLE "public"."LogActivity" DROP CONSTRAINT "LogActivity_userId_fkey";

-- AlterTable
ALTER TABLE "public"."LogActivity" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "cpf" TEXT;

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TagTask" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "projectId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Achievement" (
    "id" SERIAL NOT NULL,
    "code" "public"."AchievementCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAchievement" (
    "id" SERIAL NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "achievementId" INTEGER NOT NULL,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "public"."Tag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TagTask_tagId_taskId_key" ON "public"."TagTask"("tagId", "taskId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "public"."Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "public"."UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "User_cpf_key" ON "public"."User"("cpf");

-- AddForeignKey
ALTER TABLE "public"."LogActivity" ADD CONSTRAINT "LogActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagTask" ADD CONSTRAINT "TagTask_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TagTask" ADD CONSTRAINT "TagTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comment" ADD CONSTRAINT "Comment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
