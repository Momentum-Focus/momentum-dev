/*
  Warnings:

  - You are about to drop the column `spotifyFocusPlaylistUri` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."SavedPlaylist" ADD COLUMN     "isFocus" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "spotifyFocusPlaylistUri";

-- CreateIndex
CREATE INDEX "SavedPlaylist_userId_isFocus_idx" ON "public"."SavedPlaylist"("userId", "isFocus");
