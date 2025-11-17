/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."AuthMethod" AS ENUM ('EMAIL', 'GOOGLE');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "authMethod" "public"."AuthMethod" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "googleAccessToken" TEXT,
ADD COLUMN     "googleId" TEXT,
ADD COLUMN     "googleRefreshToken" TEXT,
ADD COLUMN     "isGoogleConnected" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "public"."User"("googleId");
