-- CreateTable
CREATE TABLE "keywords" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "term" TEXT NOT NULL,
    "last_searched_at" DATETIME,
    "search_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

-- CreateTable
CREATE TABLE "keyword_searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword_id" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "score_value" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "keyword_searches_keyword_id_fkey" FOREIGN KEY ("keyword_id") REFERENCES "keywords" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "keywords_term_key" ON "keywords"("term");

-- CreateIndex
CREATE INDEX "keyword_searches_keyword_id_created_at_idx" ON "keyword_searches"("keyword_id", "created_at");
