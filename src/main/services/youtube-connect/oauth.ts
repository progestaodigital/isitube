import { shell } from 'electron';
import http from 'node:http';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Retenção/CTR/AVD/views + receita (o usuário habilitou o escopo monetary).
export const YT_ANALYTICS_SCOPES = [
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
];

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export type OAuthTokens = {
  refreshToken: string | null;
  accessToken: string;
  scope: string | null;
  expiresInSec: number;
};

const SUCCESS_HTML = `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>isiTube</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f0f0f;color:#fff;display:flex;height:100vh;align-items:center;justify-content:center;margin:0">
<div style="text-align:center"><div style="font-size:44px">✓</div><h2>Canal conectado ao isiTube</h2>
<p style="opacity:.7">Pode fechar esta aba e voltar ao app.</p></div></body></html>`;

/**
 * OAuth 2.0 (Authorization Code + PKCE) com redirect loopback. Abre o navegador
 * do sistema, sobe um http server temporário em 127.0.0.1 pra capturar o code, e
 * troca por tokens. Client tipo "App para computador" do Google aceita loopback
 * em qualquer porta, então não precisa registrar redirect URI.
 */
export async function runOAuthFlow(
  clientId: string,
  clientSecret: string,
  scopes: string[]
): Promise<OAuthTokens> {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));

  return new Promise<OAuthTokens>((resolve, reject) => {
    let settled = false;
    let port = 0;

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        server.close();
      } catch {
        /* ignore */
      }
      fn();
    };

    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
      const code = reqUrl.searchParams.get('code');
      const err = reqUrl.searchParams.get('error');
      const returnedState = reqUrl.searchParams.get('state');

      // Ignora requests que não são o callback (favicon etc.).
      if (!code && !err) {
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(SUCCESS_HTML);

      if (err) return finish(() => reject(new Error(`Autorização recusada (${err}).`)));
      if (returnedState !== state) {
        return finish(() => reject(new Error('State inválido — possível interferência.')));
      }
      if (!code) return finish(() => reject(new Error('Sem código de autorização na resposta.')));

      try {
        const body = new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: `http://127.0.0.1:${port}`,
        });
        const tr = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        const json = (await tr.json()) as Record<string, unknown>;
        if (!tr.ok) {
          const msg = String(json.error_description ?? json.error ?? 'Falha na troca de tokens.');
          return finish(() => reject(new Error(msg)));
        }
        finish(() =>
          resolve({
            refreshToken: (json.refresh_token as string) ?? null,
            accessToken: json.access_token as string,
            scope: (json.scope as string) ?? null,
            expiresInSec: Number(json.expires_in ?? 3600),
          })
        );
      } catch (e) {
        finish(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    });

    const timer = setTimeout(
      () => finish(() => reject(new Error('Tempo esgotado — a autorização não foi concluída.'))),
      5 * 60 * 1000
    );

    server.on('error', (e) => finish(() => reject(e)));
    server.listen(0, '127.0.0.1', () => {
      port = (server.address() as AddressInfo).port;
      const authUrl = new URL(AUTH_ENDPOINT);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', `http://127.0.0.1:${port}`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes.join(' '));
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('code_challenge', challenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('state', state);
      void shell.openExternal(authUrl.toString());
    });
  });
}

/** Refresh token revogado/expirado (invalid_grant) — precisa reconectar. */
export class InvalidGrantError extends Error {
  constructor() {
    super('INVALID_GRANT');
    this.name = 'InvalidGrantError';
  }
}

/** Troca o refresh_token por um access_token novo. */
export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresInSec: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const r = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await r.json()) as Record<string, unknown>;
  if (!r.ok) {
    if (json.error === 'invalid_grant') throw new InvalidGrantError();
    throw new Error(String(json.error_description ?? json.error ?? 'Falha ao renovar o token.'));
  }
  return {
    accessToken: json.access_token as string,
    expiresInSec: Number(json.expires_in ?? 3600),
  };
}
