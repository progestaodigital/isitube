-- AlterTable
ALTER TABLE "videos" ADD COLUMN "transcript_extracted_at" DATETIME;
ALTER TABLE "videos" ADD COLUMN "transcript_language" TEXT;
ALTER TABLE "videos" ADD COLUMN "transcript_segments" TEXT;
ALTER TABLE "videos" ADD COLUMN "transcript_status" TEXT;
