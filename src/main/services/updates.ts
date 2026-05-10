import { app } from 'electron';
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
  error: string | null;
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
    }

    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

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
