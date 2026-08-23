-- AlterTable
ALTER TABLE "thumbnail_generations" ADD COLUMN "character_id" TEXT;
ALTER TABLE "thumbnail_generations" ADD COLUMN "scene_id" TEXT;

-- CreateTable
CREATE TABLE "thumbnail_characters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "thumbnail_character_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "character_id" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "thumbnail_character_photos_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "thumbnail_characters" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "thumbnail_scenes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "thumbnail_character_photos_character_id_idx" ON "thumbnail_character_photos"("character_id");
