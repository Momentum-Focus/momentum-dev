-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isSpotifyConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spotifyAccessToken" TEXT,
ADD COLUMN     "spotifyRefreshToken" TEXT;
