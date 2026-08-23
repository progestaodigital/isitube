-- CreateTable
CREATE TABLE "thumbnail_assets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "source_type" TEXT NOT NULL,
    "source_video_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "thumbnail_generations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "ref_asset_ids" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "aspect_ratio" TEXT NOT NULL DEFAULT '16:9',
    "data" BLOB NOT NULL,
    "mime_type" TEXT NOT NULL,
    "cost_estimate_usd" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "thumbnail_assets_kind_created_at_idx" ON "thumbnail_assets"("kind", "created_at");

-- CreateIndex
CREATE INDEX "thumbnail_generations_created_at_idx" ON "thumbnail_generations"("created_at");
