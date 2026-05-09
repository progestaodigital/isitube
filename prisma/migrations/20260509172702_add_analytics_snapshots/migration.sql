-- AlterTable
ALTER TABLE "channels" ADD COLUMN "total_view_count" INTEGER;

-- CreateTable
CREATE TABLE "channel_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel_id" TEXT NOT NULL,
    "taken_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriber_count" INTEGER,
    "total_view_count" INTEGER,
    "video_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "channel_snapshots_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "video_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "taken_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "view_count" INTEGER NOT NULL,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "video_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "channel_snapshots_channel_id_taken_at_idx" ON "channel_snapshots"("channel_id", "taken_at");

-- CreateIndex
CREATE INDEX "video_snapshots_video_id_taken_at_idx" ON "video_snapshots"("video_id", "taken_at");
