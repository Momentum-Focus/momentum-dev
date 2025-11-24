-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "spotifyProduct" TEXT,
ADD COLUMN     "youtubeHiddenPlaylists" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "youtubeSavedPlaylists" JSONB NOT NULL DEFAULT '[]';
