-- CreateTable
CREATE TABLE "generated_ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "traffic_strategy" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "volume_tier" TEXT NOT NULL,
    "trend_direction" TEXT NOT NULL,
    "content_length_min" INTEGER NOT NULL,
    "hook_angle" TEXT NOT NULL,
    "thumbnail_concept" TEXT NOT NULL,
    "why_this_idea" TEXT NOT NULL,
    "urgency" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "niche" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateIndex
CREATE INDEX "generated_ideas_created_at_idx" ON "generated_ideas"("created_at");
