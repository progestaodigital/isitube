import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCredentialPlainText, getCredentialStatus } from './credentials';

const REPO = 'progestaodigital/isitube';

export type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string | null;
  isNewer: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  assetUrl: string | null;
  assetSize: number | null;
  /** Asset id pra usar com /releases/assets/{id} (download autenticado em repo privado). */
  assetId: number | null;
  error: string | null;
};

export type ReleaseSummary = {
  version: string;
  tagName: string;
  name: string;
  publishedAt: string;
  releaseUrl: string;
  releaseNotes: string | null;
  assetId: number | null;
  assetSize: number | null;
  isCurrent: boolean;
  isNewer: boolean;
  isOlder: boolean;
};

/**
 * Consulta a GitHub Releases API pra ver se há uma versão mais nova publicada
 * no repositório do código. Usa o token PAT que o usuário já tem configurado
 * (mesmo do backup) — não expõe o token e não exige config adicional.
 *
 * Compara a tag da release (ex: 'v0.2.0') com app.getVersion() via semver
 * básico (major.minor.patch). Pre-releases (v1.0.0-beta.1) são desempacotados
 * pro mesmo número (1.0.0) — chamadas finer-grained ficam pra v2.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion();
  const result: UpdateCheckResult = {
    currentVersion,
    latestVersion: null,
    isNewer: false,
    releaseUrl: null,
    releaseNotes: null,
    publishedAt: null,
    assetUrl: null,
    assetSize: null,
    assetId: null,
    error: null,
  };

  try {
    const status = await getCredentialStatus('github');
    if (!status?.hasValue || status.status !== 'valid') {
      result.error =
        'Configure e valide o token GitHub em Configurações pra checar atualizações.';
      return result;
    }
    const pat = await getCredentialPlainText('github');
    if (!pat) {
      result.error = 'Token GitHub indisponível.';
      return result;
    }

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (res.status === 404) {
      result.error = 'Nenhuma release publicada ainda no repositório do código.';
      return result;
    }
    if (!res.ok) {
      result.error = `Falha ao consultar GitHub (HTTP ${res.status}).`;
      return result;
    }

    const release = (await res.json()) as {
      tag_name: string;
      name: string;
      body: string | null;
      html_url: string;
      published_at: string;
      prerelease: boolean;
      draft: boolean;
      assets: Array<{ name: string; browser_download_url: string; size: number }>;
    };

    if (release.draft) {
      result.error = 'A última release é um draft — ignorada.';
      return result;
    }

    result.latestVersion = release.tag_name.replace(/^v/, '');
    result.releaseUrl = release.html_url;
    result.releaseNotes = release.body;
    result.publishedAt = release.published_at;
    result.isNewer = compareVersions(result.latestVersion, currentVersion) > 0;

    // Procura o installer .exe (Windows). Mesmo padrão do electron-builder:
    // 'isiTube-Setup-${version}.exe'.
    const exeAsset = release.assets.find((a) => a.name.endsWith('.exe'));
    if (exeAsset) {
      result.assetUrl = exeAsset.browser_download_url;
      result.assetSize = exeAsset.size;
      result.assetId = exeAsset.id;
    }

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/**
 * Lista todas as releases publicadas no repo, com classificação relativa
 * à versão atual (newer / current / older). Usado pra UI de downgrade.
 */
export async function listAllReleases(): Promise<{
  releases: ReleaseSummary[];
  error: string | null;
}> {
  const currentVersion = app.getVersion();
  try {
    const status = await getCredentialStatus('github');
    if (!status?.hasValue || status.status !== 'valid') {
      return { releases: [], error: 'Token GitHub não configurado ou inválido.' };
    }
    const pat = await getCredentialPlainText('github');
    if (!pat) return { releases: [], error: 'Token GitHub indisponível.' };

    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!res.ok) {
      return { releases: [], error: `Falha ao listar releases (HTTP ${res.status}).` };
    }

    const list = (await res.json()) as Array<{
      tag_name: string;
      name: string;
      body: string | null;
      html_url: string;
      published_at: string;
      prerelease: boolean;
      draft: boolean;
      assets: Array<{ id: number; name: string; size: number }>;
    }>;

    const releases: ReleaseSummary[] = list
      .filter((r) => !r.draft)
      .map((r) => {
        const version = r.tag_name.replace(/^v/, '');
        const cmp = compareVersions(version, currentVersion);
        const exeAsset = r.assets.find((a) => a.name.endsWith('.exe'));
        return {
          version,
          tagName: r.tag_name,
          name: r.name || r.tag_name,
          publishedAt: r.published_at,
          releaseUrl: r.html_url,
          releaseNotes: r.body,
          assetId: exeAsset?.id ?? null,
          assetSize: exeAsset?.size ?? null,
          isCurrent: cmp === 0,
          isNewer: cmp > 0,
          isOlder: cmp < 0,
        };
      });

    return { releases, error: null };
  } catch (err) {
    return {
      releases: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Baixa o asset autenticando com PAT (repo privado), salva em userData/updates,
 * e dispara o instalador. NSIS abre o wizard de instalação. Após o spawn,
 * fecha o app pra que o instalador possa sobrescrever os arquivos.
 *
 * Não é silent: o usuário ainda interage com o wizard. Pra silent install
 * precisaria de electron-updater ou oneClick: true no NSIS config.
 */
export async function downloadAndInstall(
  assetId: number,
  fileName: string
): Promise<{ success: boolean; message: string }> {
  try {
    const status = await getCredentialStatus('github');
    if (!status?.hasValue || status.status !== 'valid') {
      return { success: false, message: 'Token GitHub não configurado.' };
    }
    const pat = await getCredentialPlainText('github');
    if (!pat) return { success: false, message: 'Token indisponível.' };

    // Baixa o binário direto (Accept: octet-stream redireciona pro signed URL).
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${assetId}`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/octet-stream',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        redirect: 'follow',
      }
    );

    if (!res.ok) {
      return {
        success: false,
        message: `Falha no download (HTTP ${res.status}).`,
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const updatesDir = join(app.getPath('userData'), 'updates');
    await mkdir(updatesDir, { recursive: true });
    const installerPath = join(updatesDir, fileName);
    await writeFile(installerPath, buffer);

    // Spawna detached pra sobreviver ao quit do app. Não captura stdio.
    const child = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Pequeno delay pra garantir que o spawn aconteça antes do quit.
    setTimeout(() => app.quit(), 800);

    return {
      success: true,
      message: 'Instalador iniciado. O app vai fechar pra aplicar a atualização.',
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

void shell;

function parseVersion(s: string): [number, number, number] {
  const cleaned = s.replace(/^v/, '').split('-')[0]!;
  const parts = cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function compareVersions(a: string, b: string): number {
  const [a1, a2, a3] = parseVersion(a);
  const [b1, b2, b3] = parseVersion(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}
