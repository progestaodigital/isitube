-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_video_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "video_id" TEXT NOT NULL,
    "update_run_id" TEXT,
    "taken_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "view_count" INTEGER NOT NULL,
    "like_count" INTEGER,
    "comment_count" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "video_snapshots_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "video_snapshots_update_run_id_fkey" FOREIGN KEY ("update_run_id") REFERENCES "update_runs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_video_snapshots" ("comment_count", "created_at", "deleted_at", "id", "like_count", "synced_at", "taken_at", "updated_at", "video_id", "view_count") SELECT "comment_count", "created_at", "deleted_at", "id", "like_count", "synced_at", "taken_at", "updated_at", "video_id", "view_count" FROM "video_snapshots";
DROP TABLE "video_snapshots";
ALTER TABLE "new_video_snapshots" RENAME TO "video_snapshots";
CREATE INDEX "video_snapshots_video_id_taken_at_idx" ON "video_snapshots"("video_id", "taken_at");
CREATE INDEX "video_snapshots_update_run_id_idx" ON "video_snapshots"("update_run_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
