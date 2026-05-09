import { app } from 'electron';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPrisma } from '.';

/**
 * Apply any pending Prisma migrations programmatically. Designed to run on
 * every startup — already-applied migrations are skipped via the standard
 * `_prisma_migrations` tracking table.
 *
 * In dev, reads from `<repo>/prisma/migrations/`. In production, reads from
 * `<install>/resources/migrations/` (configured via electron-builder
 * `extraResources` in package.json).
 *
 * This avoids shipping the Prisma CLI or spawning child processes — we just
 * read the migration SQL files and execute statements via `$executeRawUnsafe`.
 * Works because Prisma's SQLite migrations are plain DDL with no embedded `;`
 * inside string literals.
 */
export async function ensureMigrationsApplied(): Promise<void> {
  const prisma = getPrisma();

  // Standard Prisma tracking table (mirrors the schema Prisma CLI creates).
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "checksum" TEXT NOT NULL,
      "finished_at" DATETIME,
      "migration_name" TEXT NOT NULL,
      "logs" TEXT,
      "rolled_back_at" DATETIME,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )
  `);

  const dir = resolveMigrationsDir();
  if (!existsSync(dir)) {
    console.warn('[migrations] Migrations directory not found at', dir);
    return;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  const migrationDirs = entries
    .filter((e) => e.isDirectory() && /^\d+_/.test(e.name))
    .map((e) => e.name)
    .sort();

  for (const name of migrationDirs) {
    const existing = (await prisma.$queryRawUnsafe(
      `SELECT id FROM "_prisma_migrations" WHERE migration_name = ?`,
      name
    )) as Array<{ id: string }>;
    if (existing.length > 0) continue;

    const sqlPath = join(dir, name, 'migration.sql');
    const sql = await readFile(sqlPath, 'utf-8');
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      await prisma.$executeRawUnsafe(stmt);
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      newMigrationId(),
      simpleChecksum(sql),
      name,
      statements.length
    );

    console.log('[migrations] Applied:', name);
  }
}

function resolveMigrationsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'migrations');
  }
  return join(process.cwd(), 'prisma', 'migrations');
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*$/m)
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter((s) => s.length > 0);
}

function newMigrationId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function simpleChecksum(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
