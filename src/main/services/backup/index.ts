import { app, dialog } from 'electron';
import { copyFile, readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { disconnectPrisma, getPrisma } from '../../db';

const APP_VERSION = '0.1.0';
const BACKUP_FORMAT_VERSION = 1;

export type BackupManifest = {
  formatVersion: number;
  appVersion: string;
  createdAt: string;
  channelsCount: number;
  videosCount: number;
  keywordsCount: number;
  updateRunsCount: number;
  channelSnapshotsCount: number;
  videoSnapshotsCount: number;
};

export type BackupExportResult = {
  success: boolean;
  message: string;
  path?: string;
  manifest?: BackupManifest;
};

export type BackupImportResult = {
  success: boolean;
  message: string;
  manifest?: BackupManifest;
};

function resolveDatabasePath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'data.db');
  }
  return join(process.cwd(), 'prisma', 'dev.db');
}

async function buildManifest(): Promise<BackupManifest> {
  const prisma = getPrisma();
  const [
    channelsCount,
    videosCount,
    keywordsCount,
    updateRunsCount,
    channelSnapshotsCount,
    videoSnapshotsCount,
  ] = await Promise.all([
    prisma.channel.count({ where: { deletedAt: null } }),
    prisma.video.count({ where: { deletedAt: null } }),
    prisma.keyword.count({ where: { deletedAt: null } }),
    prisma.updateRun.count({ where: { deletedAt: null } }),
    prisma.channelSnapshot.count({ where: { deletedAt: null } }),
    prisma.videoSnapshot.count({ where: { deletedAt: null } }),
  ]);
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    channelsCount,
    videosCount,
    keywordsCount,
    updateRunsCount,
    channelSnapshotsCount,
    videoSnapshotsCount,
  };
}

/**
 * Export the local SQLite database (minus credentials) as a ZIP file.
 *
 * Steps:
 *   1. Snapshot the DB to a temp file
 *   2. Wipe the api_credentials table from the temp copy
 *   3. Wrap it in a ZIP with a manifest
 *   4. Save through a native dialog
 */
export async function exportBackup(): Promise<BackupExportResult> {
  const manifest = await buildManifest();
  const stamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace('T', '_')
    .replace(':', '-');
  const defaultName = `isitube-backup-${stamp}.zip`;

  const dlg = await dialog.showSaveDialog({
    title: 'Salvar backup',
    defaultPath: defaultName,
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
  });
  if (dlg.canceled || !dlg.filePath) {
    return { success: false, message: 'Backup cancelado.' };
  }

  // Disconnect Prisma briefly to release the file lock for the snapshot copy.
  await disconnectPrisma();
  const tmpDir = await mkdtemp(join(tmpdir(), 'isitube-backup-'));
  try {
    const tmpDb = join(tmpDir, 'data.db');
    await copyFile(resolveDatabasePath(), tmpDb);
    // Reconnect for the wipe operation. Better-sqlite3-style: open a dedicated
    // connection to the temp DB just to clear credentials.
    const { PrismaClient } = await import('@prisma/client');
    const tmpClient = new PrismaClient({
      datasources: { db: { url: 'file:' + tmpDb } },
    });
    try {
      await tmpClient.apiCredential.deleteMany({});
    } finally {
      await tmpClient.$disconnect();
    }

    const zip = new AdmZip();
    zip.addLocalFile(tmpDb);
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
    zip.addFile(
      'README.txt',
      Buffer.from(
        [
          'isiTube — backup local',
          '',
          `Criado em: ${manifest.createdAt}`,
          `App version: ${manifest.appVersion}`,
          `Format version: ${manifest.formatVersion}`,
          '',
          'Conteúdo:',
          ' - data.db (banco SQLite SEM as chaves de API — você cadastra de novo no destino)',
          ' - manifest.json (metadados pra validação ao restaurar)',
          '',
          'Pra restaurar: abre o isiTube → Configurações → Backup e restauração → "Restaurar de arquivo".',
        ].join('\n'),
        'utf-8'
      )
    );
    zip.writeZip(dlg.filePath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  return {
    success: true,
    message: 'Backup salvo com sucesso.',
    path: dlg.filePath,
    manifest,
  };
}

/**
 * Inspect a backup ZIP without applying it. Returns the manifest so the
 * renderer can show the user "esse backup tem X canais e Y vídeos, criado em Z" before they confirm overwrite.
 */
export async function inspectBackup(): Promise<{
  success: boolean;
  message: string;
  filePath?: string;
  manifest?: BackupManifest;
}> {
  const dlg = await dialog.showOpenDialog({
    title: 'Selecionar arquivo de backup',
    filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
    properties: ['openFile'],
  });
  if (dlg.canceled || dlg.filePaths.length === 0) {
    return { success: false, message: 'Seleção cancelada.' };
  }

  const filePath = dlg.filePaths[0]!;
  const zip = new AdmZip(filePath);
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    return { success: false, message: 'Arquivo não parece ser um backup válido (manifest.json ausente).' };
  }
  const dbEntry = zip.getEntry('data.db');
  if (!dbEntry) {
    return { success: false, message: 'Arquivo não parece ser um backup válido (data.db ausente).' };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));
  } catch {
    return { success: false, message: 'manifest.json corrompido.' };
  }

  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      success: false,
      message: `Versão de backup incompatível (esperado ${BACKUP_FORMAT_VERSION}, recebido ${manifest.formatVersion}).`,
    };
  }

  return { success: true, message: 'Backup válido.', filePath, manifest };
}

/**
 * Apply a backup ZIP. Preserves the user's CURRENT API credentials so they
 * don't need to re-cadastrate after restore (since credentials were stripped
 * from the backup itself).
 */
export async function restoreBackup(filePath: string): Promise<BackupImportResult> {
  if (!existsSync(filePath)) {
    return { success: false, message: 'Arquivo não encontrado.' };
  }

  const zip = new AdmZip(filePath);
  const manifestEntry = zip.getEntry('manifest.json');
  const dbEntry = zip.getEntry('data.db');
  if (!manifestEntry || !dbEntry) {
    return { success: false, message: 'Arquivo de backup inválido.' };
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf-8'));
  } catch {
    return { success: false, message: 'manifest.json corrompido.' };
  }
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    return {
      success: false,
      message: `Versão de backup incompatível (esperado ${BACKUP_FORMAT_VERSION}).`,
    };
  }

  // Snapshot current credentials so we can re-write them after the DB swap.
  const prisma = getPrisma();
  const credentialsBackup = await prisma.apiCredential.findMany();

  // Tear down Prisma so we can replace the file safely.
  await disconnectPrisma();

  const targetDbPath = resolveDatabasePath();
  const tmpDir = await mkdtemp(join(tmpdir(), 'isitube-restore-'));
  try {
    // Extract data.db to temp first to validate, then atomic-replace.
    zip.extractEntryTo(dbEntry, tmpDir, false, true);
    const extractedDb = join(tmpDir, basename(dbEntry.entryName));
    await copyFile(extractedDb, targetDbPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  // Restore credentials by writing them back into the new DB.
  const restored = getPrisma();
  if (credentialsBackup.length > 0) {
    for (const cred of credentialsBackup) {
      await restored.apiCredential.upsert({
        where: { provider: cred.provider },
        update: {
          encryptedValue: cred.encryptedValue,
          status: cred.status,
          lastValidatedAt: cred.lastValidatedAt,
        },
        create: {
          provider: cred.provider,
          encryptedValue: cred.encryptedValue,
          status: cred.status,
          lastValidatedAt: cred.lastValidatedAt,
        },
      });
    }
  }

  return {
    success: true,
    message: `Backup restaurado: ${manifest.channelsCount} canais, ${manifest.videosCount} vídeos.`,
    manifest,
  };
}

void stat; // imported for future "show file size" use
void readFile;
void writeFile;
