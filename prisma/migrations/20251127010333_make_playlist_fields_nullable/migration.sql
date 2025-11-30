-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "spotifyHiddenPlaylists" JSONB,
ALTER COLUMN "youtubeHiddenPlaylists" DROP NOT NULL,
ALTER COLUMN "youtubeHiddenPlaylists" DROP DEFAULT,
ALTER COLUMN "youtubeSavedPlaylists" DROP NOT NULL,
ALTER COLUMN "youtubeSavedPlaylists" DROP DEFAULT;
