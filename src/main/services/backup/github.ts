import { readFile, writeFile, mkdtemp, rm, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { disconnectPrisma, getPrisma } from '../../db';
import { getCredentialPlainText, getCredentialStatus } from '../credentials';
import { getSetting, setSetting } from '../settings';
import { exportBackup } from '.';
import type {
  BackupImportResult,
  BackupManifest,
  GithubBackupConfig,
  GithubBackupRelease,
  GithubListResult,
  GithubUploadResult,
} from '@shared/types';

const GITHUB_API = 'https://api.github.com';
const REPO_SETTING_KEY = 'backup.github.repo';
const BACKUP_FORMAT_VERSION = 1;

function resolveDatabasePath(): string {
  if (app.isPackaged) {
    return join(app.getPath('userData'), 'data.db');
  }
  return join(process.cwd(), 'prisma', 'dev.db');
}

export async function getGithubBackupConfig(): Promise<GithubBackupConfig> {
  const [repo, status] = await Promise.all([
    getSetting(REPO_SETTING_KEY),
    getCredentialStatus('github'),
  ]);
  return {
    repo: repo ?? null,
    hasPat: Boolean(status?.hasValue && status?.status === 'valid'),
  };
}

export async function setGithubBackupConfig(repo: string): Promise<void> {
  const cleaned = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(cleaned)) {
    throw new Error('Repositório inválido. Formato esperado: owner/repo');
  }
  await setSetting(REPO_SETTING_KEY, cleaned);
}

async function getCredentials(): Promise<{ pat: string; repo: string }> {
  const repo = await getSetting(REPO_SETTING_KEY);
  if (!repo) throw new Error('Repositório não configurado.');
  const status = await getCredentialStatus('github');
  if (!status?.hasValue || status.status !== 'valid') {
    throw new Error('Token GitHub não configurado ou inválido.');
  }
  const pat = await getCredentialPlainText('github');
  if (!pat) throw new Error('Token GitHub indisponível.');
  return { pat, repo };
}

async function ghFetch(
  pat: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {}),
    },
  });
}

// =============================================================================
// List repos (for the dropdown selector)
// =============================================================================

export async function listGithubRepos(): Promise<{
  success: boolean;
  message: string;
  repos?: import('@shared/types').GithubRepoInfo[];
}> {
  const status = await getCredentialStatus('github');
  if (!status?.hasValue || status.status !== 'valid') {
    return { success: false, message: 'Token GitHub não configurado ou inválido.' };
  }
  const pat = await getCredentialPlainText('github');
  if (!pat) return { success: false, message: 'Token indisponível.' };

  // Pull up to 100 repos where the user has at least admin (so they can
  // create releases). Sort by recently pushed so what's relevant comes first.
  const res = await ghFetch(
    pat,
    `/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator`
  );
  if (!res.ok) {
    return { success: false, message: `Falha ao listar repositórios (HTTP ${res.status}).` };
  }

  const raw = (await res.json()) as Array<{
    full_name: string;
    private: boolean;
    description: string | null;
    pushed_at: string;
    permissions?: { admin?: boolean; push?: boolean };
  }>;

  const repos = raw
    .filter((r) => r.permissions?.push !== false) // need write access for releases
    .map((r) => ({
      fullName: r.full_name,
      private: r.private,
      description: r.description,
      pushedAt: r.pushed_at,
    }));

  return {
    success: true,
    message: `${repos.length} repositório${repos.length === 1 ? '' : 's'} encontrado${repos.length === 1 ? '' : 's'}.`,
    repos,
  };
}

// =============================================================================
// Bootstrap (initialize an empty repo so releases can be created)
// =============================================================================

async function bootstrapEmptyRepo(
  pat: string,
  repo: string
): Promise<{ success: boolean; message: string }> {
  const readme = [
    '# isiTube — Backups',
    '',
    'Este repositório armazena backups do **isiTube** como GitHub Releases.',
    'Cada release contém um arquivo `isitube-backup.zip` com seu banco de dados.',
    '',
    '> ⚠️ Não contém credenciais de API — essas ficam só no seu computador.',
    '',
    '_Inicializado automaticamente pelo isiTube._',
    '',
  ].join('\n');

  const contentB64 = Buffer.from(readme, 'utf-8').toString('base64');

  const res = await ghFetch(pat, `/repos/${repo}/contents/README.md`, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'chore: inicializar repositório de backup do isiTube',
      content: contentB64,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { success: false, message: `HTTP ${res.status}: ${body.slice(0, 150)}` };
  }
  return { success: true, message: 'Repositório inicializado com README.md.' };
}

// =============================================================================
// Upload
// =============================================================================

/**
 * Build a backup zip in a temp file (stripping credentials), then publish it
 * as a GitHub Release with the manifest in the release body.
 */
export async function uploadBackupToGithub(): Promise<GithubUploadResult> {
  let creds;
  try {
    creds = await getCredentials();
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
  const { pat, repo } = creds;

  // 1. Build the zip locally (reuse the local export pipeline but write to temp).
  const manifest = await buildLocalManifest();
  const tmpDir = await mkdtemp(join(tmpdir(), 'isitube-gh-backup-'));
  const zipPath = join(tmpDir, `isitube-backup.zip`);

  try {
    await buildZipAtPath(zipPath, manifest);

    // 2. Create the release on GitHub. If the repo is empty (no commits),
    //    GitHub returns 422 "Repository is empty" — bootstrap with a README
    //    commit and retry once.
    const tag = `backup-${manifest.createdAt.replace(/[:.]/g, '-')}`;
    const releaseBody = JSON.stringify({
      tag_name: tag,
      name: `Backup · ${new Date(manifest.createdAt).toLocaleString('pt-BR')}`,
      body: buildReleaseBody(manifest),
      draft: false,
      prerelease: false,
    });

    let createRes = await ghFetch(pat, `/repos/${repo}/releases`, {
      method: 'POST',
      body: releaseBody,
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      if (createRes.status === 422 && /repository is empty/i.test(errBody)) {
        const bootstrapped = await bootstrapEmptyRepo(pat, repo);
        if (!bootstrapped.success) {
          return {
            success: false,
            message: `Repositório vazio e não foi possível inicializar: ${bootstrapped.message}`,
          };
        }
        createRes = await ghFetch(pat, `/repos/${repo}/releases`, {
          method: 'POST',
          body: releaseBody,
        });
      }
    }

    if (!createRes.ok) {
      const errBody = await createRes.text();
      return {
        success: false,
        message: `Falha ao criar release (${createRes.status}): ${errBody.slice(0, 200)}`,
      };
    }

    const created = (await createRes.json()) as {
      id: number;
      upload_url: string;
      html_url: string;
    };

    // 3. Upload the zip as a release asset.
    const uploadUrl =
      created.upload_url.replace('{?name,label}', '') +
      `?name=${encodeURIComponent('isitube-backup.zip')}`;
    const fileStat = await stat(zipPath);
    const fileBuf = await readFile(zipPath);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        'Content-Type': 'application/zip',
        'Content-Length': String(fileStat.size),
      },
      body: fileBuf,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      return {
        success: false,
        message: `Release criado mas upload do .zip falhou (${uploadRes.status}): ${errBody.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      message: `Backup enviado pra ${repo}.`,
      releaseUrl: created.html_url,
    };
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

async function buildLocalManifest(): Promise<BackupManifest> {
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
    appVersion: '0.1.0',
    createdAt: new Date().toISOString(),
    channelsCount,
    videosCount,
    keywordsCount,
    updateRunsCount,
    channelSnapshotsCount,
    videoSnapshotsCount,
  };
}

async function buildZipAtPath(targetZipPath: string, manifest: BackupManifest): Promise<void> {
  await disconnectPrisma();
  const tmpDir = await mkdtemp(join(tmpdir(), 'isitube-zip-'));
  try {
    const tmpDb = join(tmpDir, 'data.db');
    await copyFile(resolveDatabasePath(), tmpDb);

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
    zip.writeZip(targetZipPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function buildReleaseBody(manifest: BackupManifest): string {
  return [
    '## Backup do isiTube',
    '',
    `**Criado em:** ${new Date(manifest.createdAt).toLocaleString('pt-BR')}`,
    `**Versão do app:** ${manifest.appVersion}`,
    '',
    '### Conteúdo',
    `- ${manifest.channelsCount} canais`,
    `- ${manifest.videosCount} vídeos`,
    `- ${manifest.keywordsCount} palavras-chave`,
    `- ${manifest.updateRunsCount} atualizações`,
    `- ${manifest.channelSnapshotsCount} snapshots de canal`,
    `- ${manifest.videoSnapshotsCount} snapshots de vídeo`,
    '',
    '_(Sem credenciais de API — você cadastra de novo no destino.)_',
    '',
    '```json',
    JSON.stringify(manifest, null, 2),
    '```',
  ].join('\n');
}

// =============================================================================
// List
// =============================================================================

export async function listGithubBackups(): Promise<GithubListResult> {
  let creds;
  try {
    creds = await getCredentials();
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
  const { pat, repo } = creds;

  const res = await ghFetch(pat, `/repos/${repo}/releases?per_page=50`);
  if (!res.ok) {
    return {
      success: false,
      message: `Falha ao listar releases (${res.status}).`,
    };
  }

  const releases = (await res.json()) as Array<{
    id: number;
    tag_name: string;
    name: string;
    created_at: string;
    body: string | null;
    assets: Array<{ id: number; name: string; size: number }>;
  }>;

  const filtered: GithubBackupRelease[] = [];
  for (const r of releases) {
    const asset = r.assets.find((a) => a.name === 'isitube-backup.zip');
    if (!asset) continue;
    let manifest: BackupManifest | undefined;
    if (r.body) {
      const match = r.body.match(/```json\s*([\s\S]*?)```/);
      if (match) {
        try {
          manifest = JSON.parse(match[1]!.trim());
        } catch {
          /* ignore */
        }
      }
    }
    filtered.push({
      id: r.id,
      tagName: r.tag_name,
      name: r.name,
      createdAt: r.created_at,
      manifest,
      assetId: asset.id,
      assetSize: asset.size,
    });
  }

  return { success: true, message: `${filtered.length} backup${filtered.length !== 1 ? 's' : ''}.`, releases: filtered };
}

// =============================================================================
// Restore
// =============================================================================

export async function restoreFromGithub(releaseId: number): Promise<BackupImportResult> {
  let creds;
  try {
    creds = await getCredentials();
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
  const { pat, repo } = creds;

  // Find the asset id
  const releaseRes = await ghFetch(pat, `/repos/${repo}/releases/${releaseId}`);
  if (!releaseRes.ok) {
    return { success: false, message: `Release não encontrado (${releaseRes.status}).` };
  }
  const release = (await releaseRes.json()) as {
    assets: Array<{ id: number; name: string }>;
  };
  const asset = release.assets.find((a) => a.name === 'isitube-backup.zip');
  if (!asset) {
    return { success: false, message: 'Asset isitube-backup.zip ausente nesse release.' };
  }

  // Download the asset (binary). GitHub redirects to a signed URL.
  const dlRes = await fetch(`${GITHUB_API}/repos/${repo}/releases/assets/${asset.id}`, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/octet-stream',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    redirect: 'follow',
  });
  if (!dlRes.ok) {
    return { success: false, message: `Download falhou (${dlRes.status}).` };
  }
  const arrayBuffer = await dlRes.arrayBuffer();
  const zipBuffer = Buffer.from(arrayBuffer);

  const tmpDir = await mkdtemp(join(tmpdir(), 'isitube-gh-restore-'));
  const zipPath = join(tmpDir, 'backup.zip');
  try {
    await writeFile(zipPath, zipBuffer);
    // Reuse the existing local restore pipeline.
    const { restoreBackup } = await import('.');
    return await restoreBackup(zipPath);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

void existsSync;
void basename;
void exportBackup;
