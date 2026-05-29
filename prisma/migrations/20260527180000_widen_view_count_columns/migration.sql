-- Widen view-count columns from INTEGER to BIGINT.
--
-- Why: channels com >2.1B total_view_count (T-Series 230B+, MrBeast 90B+)
-- explodiam o tipo Int do Prisma e quebravam `listChannels` inteiro.
-- O storage real do SQLite já é 64-bit em ambos — só o type hint mudou —
-- por isso o INSERT preserva os dados sem conversão.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- channels: subscriber_count, total_view_count → BIGINT
CREATE TABLE "new_channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "subscriber_count" BIGINT,
    "video_count" INTEGER,
    "total_view_count" BIGINT,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "last_updated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);
INSERT INTO "new_channels" ("id", "youtube_id", "title", "thumbnail_url", "subscriber_count", "video_count", "total_view_count", "monitored", "last_updated_at", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "youtube_id", "title", "thumbnail_url", "subscriber_count", "video_count", "total_view_count", "monitored", "last_updated_at", "created_at", "updated_at", "synced_at", "deleted_at" FROM "channels";
DROP TABLE "channels";
ALTER TABLE "new_channels" RENAME TO "channels";
CREATE UNIQUE INDEX "channels_youtube_id_key" ON "channels"("youtube_id");

-- videos: view_count → BIGINT
CREATE TABLE "new_videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtube_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "duration_sec" INTEGER,
    "published_at" DATETIME NOT NULL,
    "channel_avg_views_at_check" INTEGER,
    "outlier_percent" REAL,
    "flagged_as_outlier" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "tags" TEXT,
    "thumbnail_hd_url" TEXT,
    "language" TEXT,
    "category" TEXT,
    "live_broadcast_status" TEXT,
    "metadata_extracted_at" DATETIME,
    "transcript_segments" TEXT,
    "transcript_status" TEXT,
    "transcript_language" TEXT,
    "transcript_extracted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_videos" ("id", "youtube_id", "channel_id", "title", "thumbnail_url", "view_count", "like_count", "comment_count", "duration_sec", "published_at", "channel_avg_views_at_check", "outlier_percent", "flagged_as_outlier", "description", "tags", "thumbnail_hd_url", "language", "category", "live_broadcast_status", "metadata_extracted_at", "transcript_segments", "transcript_status", "transcript_language", "transcript_extracted_at", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "youtube_id", "channel_id", "title", "thumbnail_url", "view_count", "like_count", "comment_count", "duration_sec", "published_at", "channel_avg_views_at_check", "outlier_percent", "flagged_as_outlier", "description", "tags", "thumbnail_hd_url", "language", "category", "live_broadcast_status", "metadata_extracted_at", "transcript_segments", "transcript_status", "transcript_language", "transcript_extracted_at", "created_at", "updated_at", "synced_at", "deleted_at" FROM "videos";
DROP TABLE "videos";
ALTER TABLE "new_videos" RENAME TO "videos";
CREATE UNIQUE INDEX "videos_youtube_id_key" ON "videos"("youtube_id");
CREATE INDEX "videos_channel_id_published_at_idx" ON "videos"("channel_id", "published_at");
CREATE INDEX "videos_flagged_as_outlier_published_at_idx" ON "videos"("flagged_as_outlier", "published_at");
CREATE INDEX "videos_metadata_extracted_at_idx" ON "videos"("metadata_extracted_at");

-- channel_snapshots: subscriber_count, total_view_count → BIGINT
CREATE TABLE "new_channel_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "taken_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriber_count" BIGINT,
    "total_view_count" BIGINT,
    "video_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "channel_snapshots_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_channel_snapshots" ("id", "channel_id", "taken_at", "subscriber_count", "total_view_count", "video_count", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "channel_id", "taken_at", "subscriber_count", "total_view_count", "video_count", "created_at", "updated_at", "synced_at", "deleted_at" FROM "channel_snapshots";
DROP TABLE "channel_snapshots";
ALTER TABLE "new_channel_snapshots" RENAME TO "channel_snapshots";
CREATE INDEX "channel_snapshots_channel_id_taken_at_idx" ON "channel_snapshots"("channel_id", "taken_at");

-- video_snapshots: view_count → BIGINT
CREATE TABLE "new_video_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "update_run_id" TEXT,
    "taken_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "view_count" BIGINT NOT NULL,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "video_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_snapshots_update_run_id_fkey" FOREIGN KEY ("update_run_id") REFERENCES "update_runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_video_snapshots" ("id", "video_id", "update_run_id", "taken_at", "view_count", "like_count", "comment_count", "created_at", "updated_at", "synced_at", "deleted_at") SELECT "id", "video_id", "update_run_id", "taken_at", "view_count", "like_count", "comment_count", "created_at", "updated_at", "synced_at", "deleted_at" FROM "video_snapshots";
DROP TABLE "video_snapshots";
ALTER TABLE "new_video_snapshots" RENAME TO "video_snapshots";
CREATE INDEX "video_snapshots_video_id_taken_at_idx" ON "video_snapshots"("video_id", "taken_at");
CREATE INDEX "video_snapshots_update_run_id_idx" ON "video_snapshots"("update_run_id");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
