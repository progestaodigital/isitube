-- CreateTable
CREATE TABLE "channels" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtube_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "subscriber_count" INTEGER,
    "video_count" INTEGER,
    "monitored" BOOLEAN NOT NULL DEFAULT true,
    "last_updated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "youtube_id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "duration_sec" INTEGER,
    "published_at" DATETIME NOT NULL,
    "channel_avg_views_at_check" INTEGER,
    "outlier_percent" REAL,
    "flagged_as_outlier" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "videos_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "update_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "triggered_by" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "channels_total" INTEGER NOT NULL DEFAULT 0,
    "channels_successful" INTEGER NOT NULL DEFAULT 0,
    "channels_failed" INTEGER NOT NULL DEFAULT 0,
    "videos_new" INTEGER NOT NULL DEFAULT 0,
    "videos_flagged" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "scheduled_updates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduled_at" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "ran_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_youtube_id_key" ON "channels"("youtube_id");

-- CreateIndex
CREATE UNIQUE INDEX "videos_youtube_id_key" ON "videos"("youtube_id");

-- CreateIndex
CREATE INDEX "videos_channel_id_published_at_idx" ON "videos"("channel_id", "published_at");

-- CreateIndex
CREATE INDEX "videos_flagged_as_outlier_published_at_idx" ON "videos"("flagged_as_outlier", "published_at");

-- CreateIndex
CREATE INDEX "update_runs_started_at_idx" ON "update_runs"("started_at");

-- CreateIndex
CREATE INDEX "scheduled_updates_active_scheduled_at_idx" ON "scheduled_updates"("active", "scheduled_at");
