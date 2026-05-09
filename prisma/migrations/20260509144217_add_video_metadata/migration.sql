-- AlterTable
ALTER TABLE "videos" ADD COLUMN "category" TEXT;
ALTER TABLE "videos" ADD COLUMN "description" TEXT;
ALTER TABLE "videos" ADD COLUMN "language" TEXT;
ALTER TABLE "videos" ADD COLUMN "live_broadcast_status" TEXT;
ALTER TABLE "videos" ADD COLUMN "metadata_extracted_at" DATETIME;
ALTER TABLE "videos" ADD COLUMN "tags" TEXT;
ALTER TABLE "videos" ADD COLUMN "thumbnail_hd_url" TEXT;

-- CreateIndex
CREATE INDEX "videos_metadata_extracted_at_idx" ON "videos"("metadata_extracted_at");
