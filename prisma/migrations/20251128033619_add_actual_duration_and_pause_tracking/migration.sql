-- AlterTable
ALTER TABLE "public"."DailyLog" ADD COLUMN     "totalPauseMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."Task" ADD COLUMN     "actualDurationMinutes" INTEGER NOT NULL DEFAULT 0;
