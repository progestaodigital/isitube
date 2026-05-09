import { safeStorage } from 'electron';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { getPrisma } from '../db';
import type {
  CredentialActionResult,
  CredentialProvider,
  CredentialStatus,
} from '@shared/types';

const ALL_PROVIDERS: CredentialProvider[] = [
  'anthropic',
  'youtube',
  'keywords_everywhere',
  'github',
];

function ensureEncryptionAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Criptografia segura indisponível neste sistema (safeStorage). ' +
        'No Windows, isso geralmente indica um perfil de usuário corrompido.'
    );
  }
}

export async function listCredentialStatuses(): Promise<CredentialStatus[]> {
  const rows = await getPrisma().apiCredential.findMany();
  return ALL_PROVIDERS.map((provider) => {
    const found = rows.find((r) => r.provider === provider);
    return {
      provider,
      status: (found?.status as CredentialStatus['status']) ?? 'missing',
      lastValidatedAt: found?.lastValidatedAt?.toISOString() ?? null,
      hasValue: Boolean(found?.encryptedValue),
    };
  });
}

export async function setCredential(
  provider: CredentialProvider,
  plainKey: string
): Promise<CredentialActionResult> {
  if (!plainKey || plainKey.trim().length < 4) {
    return { success: false, message: 'Chave inválida (muito curta).' };
  }
  ensureEncryptionAvailable();

  const encrypted = safeStorage.encryptString(plainKey.trim());

  await getPrisma().apiCredential.upsert({
    where: { provider },
    update: {
      encryptedValue: encrypted,
      status: 'untested',
      lastValidatedAt: null,
      deletedAt: null,
    },
    create: {
      provider,
      encryptedValue: encrypted,
      status: 'untested',
    },
  });

  return { success: true, message: 'Chave salva. Use "Testar conexão" para validar.' };
}

export async function deleteCredential(provider: CredentialProvider): Promise<void> {
  await getPrisma().apiCredential.update({
    where: { provider },
    data: {
      encryptedValue: null,
      status: 'missing',
      lastValidatedAt: null,
    },
  });
}

/**
 * Real validation per provider. Calls a low-cost authenticated endpoint and
 * persists the resulting status. On 401/403 the credential is marked
 * `invalid` so downstream services know to refuse to use it.
 */
export async function testCredential(
  provider: CredentialProvider
): Promise<CredentialActionResult> {
  const cred = await getPrisma().apiCredential.findUnique({ where: { provider } });
  if (!cred?.encryptedValue) {
    return { success: false, message: 'Nenhuma chave cadastrada para testar.' };
  }
  ensureEncryptionAvailable();
  const plainKey = safeStorage.decryptString(Buffer.from(cred.encryptedValue));

  let result: CredentialActionResult;
  switch (provider) {
    case 'anthropic':
      result = await testAnthropic(plainKey);
      break;
    case 'youtube':
      result = await testYoutube(plainKey);
      break;
    case 'keywords_everywhere':
      result = await testKeywordsEverywhere(plainKey);
      break;
    case 'github':
      result = await testGithub(plainKey);
      break;
  }

  await getPrisma().apiCredential.update({
    where: { provider },
    data: {
      status: result.success ? 'valid' : 'invalid',
      lastValidatedAt: new Date(),
    },
  });

  return result;
}

async function testAnthropic(plainKey: string): Promise<CredentialActionResult> {
  try {
    const client = createAnthropic({ apiKey: plainKey });
    await generateText({
      model: client('claude-haiku-4-5-20251001'),
      prompt: 'ok',
      maxOutputTokens: 1,
    });
    return { success: true, message: 'Chave válida — conexão com a Anthropic estabelecida.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/401|invalid.*key|authentication/i.test(message)) {
      return { success: false, message: 'Chave rejeitada pela Anthropic (401).' };
    }
    if (/network|fetch failed|enotfound|econnrefused/i.test(message)) {
      return { success: false, message: 'Sem conexão com a Anthropic. Verifique sua internet.' };
    }
    return { success: false, message };
  }
}

async function testKeywordsEverywhere(plainKey: string): Promise<CredentialActionResult> {
  try {
    const formData = new URLSearchParams();
    formData.append('country', 'br');
    formData.append('currency', 'BRL');
    formData.append('dataSource', 'gkp');
    formData.append('kw[]', 'test');

    const res = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
      method: 'POST',
      headers: { Authorization: `Bearer ${plainKey}` },
      body: formData,
    });

    if (res.ok) {
      const json = await res.json().catch(() => null);
      const credits = typeof json?.credits === 'number' ? json.credits : null;
      return {
        success: true,
        message:
          credits !== null
            ? `Chave válida — ${credits.toLocaleString('pt-BR')} créditos restantes.`
            : 'Chave válida.',
      };
    }
    if (res.status === 401 || res.status === 402) {
      return { success: false, message: 'Chave rejeitada ou sem créditos.' };
    }
    return { success: false, message: `Falha (HTTP ${res.status}).` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha de rede ao testar a chave.',
    };
  }
}

async function testGithub(plainKey: string): Promise<CredentialActionResult> {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${plainKey}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (res.ok) {
      const body = (await res.json()) as { login?: string };
      return {
        success: true,
        message: body.login
          ? `Conectado como @${body.login}.`
          : 'Token válido.',
      };
    }
    if (res.status === 401) {
      return { success: false, message: 'Token rejeitado pelo GitHub (401).' };
    }
    if (res.status === 403) {
      return {
        success: false,
        message: 'Token sem permissão (403). Precisa do scope `repo`.',
      };
    }
    return { success: false, message: `Falha (HTTP ${res.status}).` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha de rede.',
    };
  }
}

async function testYoutube(plainKey: string): Promise<CredentialActionResult> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/i18nLanguages?part=snippet&key=${encodeURIComponent(plainKey)}`;
    const res = await fetch(url);
    if (res.ok) {
      return { success: true, message: 'Chave válida — YouTube Data API respondeu OK.' };
    }
    let apiMsg: string | undefined;
    try {
      const body = await res.json();
      apiMsg = body?.error?.message;
    } catch {
      /* swallow */
    }
    if (res.status === 400 || res.status === 403) {
      return {
        success: false,
        message: apiMsg ?? 'Chave rejeitada pela Google API (verifique se a YouTube Data API v3 está habilitada).',
      };
    }
    return { success: false, message: apiMsg ?? `Falha (HTTP ${res.status}).` };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha de rede ao testar a chave.',
    };
  }
}

/**
 * Internal-only: returns the decrypted credential.
 * MUST NEVER be exposed via IPC. Used by main-process service code only.
 */
export async function getCredentialPlainText(
  provider: CredentialProvider
): Promise<string | null> {
  const cred = await getPrisma().apiCredential.findUnique({ where: { provider } });
  if (!cred?.encryptedValue) return null;
  ensureEncryptionAvailable();
  return safeStorage.decryptString(Buffer.from(cred.encryptedValue));
}

export async function getCredentialStatus(
  provider: CredentialProvider
): Promise<CredentialStatus | null> {
  const all = await listCredentialStatuses();
  return all.find((s) => s.provider === provider) ?? null;
}
