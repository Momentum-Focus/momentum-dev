/*
  Warnings:

  - You are about to drop the column `spotifyHiddenPlaylists` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeHiddenPlaylists` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `youtubeSavedPlaylists` on the `User` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."MediaProvider" AS ENUM ('SPOTIFY', 'YOUTUBE');

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "spotifyHiddenPlaylists",
DROP COLUMN "youtubeHiddenPlaylists",
DROP COLUMN "youtubeSavedPlaylists";

-- CreateTable
CREATE TABLE "public"."SavedPlaylist" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "externalId" TEXT NOT NULL,
    "provider" "public"."MediaProvider" NOT NULL,
    "title" TEXT,
    "thumbnailUrl" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SavedPlaylist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedPlaylist_userId_provider_isHidden_idx" ON "public"."SavedPlaylist"("userId", "provider", "isHidden");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPlaylist_userId_externalId_provider_key" ON "public"."SavedPlaylist"("userId", "externalId", "provider");

-- AddForeignKey
ALTER TABLE "public"."SavedPlaylist" ADD CONSTRAINT "SavedPlaylist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
