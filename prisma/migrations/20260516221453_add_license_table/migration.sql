-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "license_key" BLOB NOT NULL,
    "hwid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "expires_at" DATETIME,
    "grace_until" DATETIME,
    "subscription_url" TEXT,
    "support_url" TEXT,
    "last_validated_at" DATETIME NOT NULL,
    "last_response_json" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "synced_at" DATETIME,
    "deleted_at" DATETIME
);
