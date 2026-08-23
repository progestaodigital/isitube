import { safeStorage } from 'electron';
import { getPrisma } from '../../db';
import { getActivePlan } from '../license';
import { recordFailure, recordSuccess } from '../telemetry/providers';
import {
  InvalidGrantError,
  refreshAccessToken,
  runOAuthFlow,
  YT_ANALYTICS_SCOPES,
} from './oauth';
import type { YoutubeConnectResult, YoutubeConnectionStatus } from '@shared/types';

function enc(plain: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Criptografia segura indisponível neste sistema.');
  }
  return safeStorage.encryptString(plain);
}

function dec(buf: Uint8Array | null | undefined): string | null {
  if (!buf) return null;
  return safeStorage.decryptString(Buffer.from(buf));
}

async function getRow() {
  return getPrisma().youtubeConnection.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getConnectionStatus(): Promise<YoutubeConnectionStatus> {
  const row = await getRow();
  return {
    hasConfig: Boolean(row?.clientId),
    connected: Boolean(row?.refreshToken) && !(row?.needsReconnect ?? false),
    channelTitle: row?.channelTitle ?? null,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    scope: row?.scope ?? null,
    needsReconnect: row?.needsReconnect ?? false,
    lastError: row?.lastError ?? null,
  };
}

export async function setOAuthConfig(
  clientId: string,
  clientSecret: string
): Promise<YoutubeConnectionStatus> {
  const id = clientId.trim();
  const secret = clientSecret.trim();
  if (!id || !secret) throw new Error('Client ID e Client Secret são obrigatórios.');

  const prisma = getPrisma();
  const row = await getRow();
  // Trocar a config zera a conexão atual (tokens/canal).
  const data = {
    clientId: id,
    clientSecret: enc(secret),
    refreshToken: null,
    scope: null,
    channelId: null,
    channelTitle: null,
    connectedAt: null,
    needsReconnect: false,
    lastError: null,
  };
  if (row) await prisma.youtubeConnection.update({ where: { id: row.id }, data });
  else await prisma.youtubeConnection.create({ data });
  accessCache = null;
  return getConnectionStatus();
}

export async function connect(): Promise<YoutubeConnectResult> {
  if ((await getActivePlan()) !== 'pro') {
    return { success: false, message: 'Conectar o canal é um recurso do plano Pro.' };
  }
  const row = await getRow();
  if (!row?.clientId || !row.clientSecret) {
    return { success: false, message: 'Configure o Client ID e o Secret antes de conectar.' };
  }
  const clientSecret = dec(row.clientSecret);
  if (!clientSecret) return { success: false, message: 'Não foi possível ler o Client Secret.' };

  try {
    const tokens = await runOAuthFlow(row.clientId, clientSecret, YT_ANALYTICS_SCOPES);
    if (!tokens.refreshToken) {
      return {
        success: false,
        message:
          'O Google não retornou um refresh token. Isso acontece quando você já autorizou antes: ' +
          'revogue o acesso do app em myaccount.google.com/permissions e tente conectar de novo.',
      };
    }
    await getPrisma().youtubeConnection.update({
      where: { id: row.id },
      data: {
        refreshToken: enc(tokens.refreshToken),
        scope: tokens.scope,
        connectedAt: new Date(),
        needsReconnect: false,
        lastError: null,
      },
    });
    accessCache = null;
    recordSuccess('youtube-analytics');
    return { success: true, message: 'Canal conectado!', status: await getConnectionStatus() };
  } catch (err) {
    recordFailure('youtube-analytics', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha ao conectar o canal.',
    };
  }
}

export async function disconnect(): Promise<void> {
  const row = await getRow();
  if (!row) return;
  await getPrisma().youtubeConnection.update({
    where: { id: row.id },
    data: {
      refreshToken: null,
      scope: null,
      channelId: null,
      channelTitle: null,
      connectedAt: null,
      needsReconnect: false,
      lastError: null,
    },
  });
  accessCache = null;
}

// Access token em cache na memória (renovado antes de expirar).
let accessCache: { token: string; expiresAt: number } | null = null;

/**
 * Retorna um access token válido pra chamar a YouTube Analytics API. Renova via
 * refresh_token quando necessário. Se o refresh falhar com invalid_grant (7 dias
 * do modo Teste ou revogado), marca `needsReconnect` e lança um erro claro.
 */
export async function getAccessToken(): Promise<string> {
  if (accessCache && Date.now() < accessCache.expiresAt - 60_000) return accessCache.token;

  const row = await getRow();
  if (!row?.clientId || !row.clientSecret || !row.refreshToken) {
    throw new Error('Canal não conectado.');
  }
  const clientSecret = dec(row.clientSecret);
  const refreshToken = dec(row.refreshToken);
  if (!clientSecret || !refreshToken) throw new Error('Credenciais ilegíveis.');

  try {
    const { accessToken, expiresInSec } = await refreshAccessToken(
      row.clientId,
      clientSecret,
      refreshToken
    );
    accessCache = { token: accessToken, expiresAt: Date.now() + expiresInSec * 1000 };
    recordSuccess('youtube-analytics');
    return accessToken;
  } catch (err) {
    recordFailure('youtube-analytics', err);
    if (err instanceof InvalidGrantError) {
      await getPrisma().youtubeConnection.update({
        where: { id: row.id },
        data: { needsReconnect: true, lastError: 'A conexão expirou. Reconecte o canal.' },
      });
      accessCache = null;
      throw new Error('A conexão com o Google expirou. Reconecte o canal.');
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}
