import { app } from 'electron';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

function resolveDatabasePath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'data.db');
  }
  // Dev mode: use the migrated dev.db at the project root.
  return join(process.cwd(), 'prisma', 'dev.db');
}

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) {
    process.env['DATABASE_URL'] = 'file:' + resolveDatabasePath();
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = undefined;
  }
}
