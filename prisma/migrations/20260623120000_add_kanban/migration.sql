-- Kanban (Module 6) — board único de planejamento de vídeos.

CREATE TABLE "kanban_columns" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);

CREATE INDEX "kanban_columns_position_idx" ON "kanban_columns"("position");

CREATE TABLE "kanban_cards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "column_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "main_keyword" TEXT,
    "linked_keyword_id" TEXT,
    "secondary_keywords" TEXT,
    "script" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME,
    CONSTRAINT "kanban_cards_column_id_fkey" FOREIGN KEY ("column_id") REFERENCES "kanban_columns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kanban_cards_linked_keyword_id_fkey" FOREIGN KEY ("linked_keyword_id") REFERENCES "keywords" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "kanban_cards_column_id_position_idx" ON "kanban_cards"("column_id", "position");
CREATE INDEX "kanban_cards_linked_keyword_id_idx" ON "kanban_cards"("linked_keyword_id");

CREATE TABLE "kanban_card_thumbnails" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "card_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "data" BLOB NOT NULL,
    "mime_type" TEXT NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kanban_card_thumbnails_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "kanban_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "kanban_card_thumbnails_card_id_position_idx" ON "kanban_card_thumbnails"("card_id", "position");

CREATE TABLE "kanban_card_references" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "card_id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "ref_type" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kanban_card_references_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "kanban_cards" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kanban_card_references_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "kanban_card_references_card_id_video_id_ref_type_key" ON "kanban_card_references"("card_id", "video_id", "ref_type");
CREATE INDEX "kanban_card_references_video_id_idx" ON "kanban_card_references"("video_id");

-- Seed: cria a coluna default "Ideia" na primeira instalação. Idempotente:
-- só insere se a tabela estiver vazia. O ID é gerado via lower-hex randomico
-- pra não depender de extensão UUID do SQLite.
INSERT INTO "kanban_columns" ("id", "name", "position", "collapsed", "created_at", "updated_at")
SELECT lower(hex(randomblob(16))), 'Ideia', 0, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "kanban_columns" LIMIT 1);
