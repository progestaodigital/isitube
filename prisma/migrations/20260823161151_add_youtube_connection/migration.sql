-- CreateTable
CREATE TABLE "youtube_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "client_secret" BLOB NOT NULL,
    "refresh_token" BLOB,
    "scope" TEXT,
    "channel_id" TEXT,
    "channel_title" TEXT,
    "connected_at" DATETIME,
    "needs_reconnect" BOOLEAN NOT NULL DEFAULT false,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);
