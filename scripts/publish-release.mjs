#!/usr/bin/env node
// Publica/atualiza uma release no GitHub e faz upload do .exe correspondente.
//
// Uso:
//   $env:GITHUB_TOKEN="ghp_..."        # PowerShell
//   node scripts/publish-release.mjs 0.2.5
//
// O que faz:
//   1. Procura dist/isiTube-Setup-{version}.exe
//   2. Encontra ou cria a release no GitHub com tag v{version}
//   3. Se já existir um asset com mesmo nome, deleta antes (re-upload limpo)
//   4. Faz upload do .exe direto via API REST (sem trava da web UI)
//
// Por que: a UI web do GitHub trava em uploads grandes (~100 MB). API funciona.

import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = 'progestaodigital/isitube';

async function main() {
  const version = process.argv[2];
  if (!version) {
    fail('Uso: node scripts/publish-release.mjs <version>\n  ex: node scripts/publish-release.mjs 0.2.6');
  }
  const cleanVersion = version.replace(/^v/, '');
  const tag = `v${cleanVersion}`;
  const fileName = `isiTube-Setup-${cleanVersion}.exe`;
  const filePath = resolve(__dirname, '..', 'dist', fileName);

  if (!existsSync(filePath)) {
    fail(`Arquivo não encontrado: ${filePath}\nRoda 'npm run build:win' primeiro.`);
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    fail(
      'GITHUB_TOKEN não configurado. Setta antes:\n' +
        '  PowerShell: $env:GITHUB_TOKEN="ghp_seu_token"\n' +
        '  cmd:        set GITHUB_TOKEN=ghp_seu_token\n' +
        '  bash:       export GITHUB_TOKEN=ghp_seu_token\n\n' +
        'Pega o mesmo token que você cadastrou no app (Configurações → GitHub).'
    );
  }

  const fileStats = await stat(filePath);
  console.log(`📦 ${fileName} — ${(fileStats.size / 1024 / 1024).toFixed(1)} MB`);

  // 1) Find or create release
  let release = await findReleaseByTag(token, tag);
  if (release) {
    console.log(`✓ Release ${tag} já existe (id=${release.id})`);
  } else {
    console.log(`+ Criando release ${tag}...`);
    release = await createRelease(token, tag);
    console.log(`✓ Release criado: ${release.html_url}`);
  }

  // 2) Delete existing asset with same name (idempotent re-upload)
  const existingAsset = release.assets.find((a) => a.name === fileName);
  if (existingAsset) {
    console.log(`- Deletando asset existente (${existingAsset.id})...`);
    await deleteAsset(token, existingAsset.id);
  }

  // 3) Upload
  console.log(`↑ Fazendo upload de ${fileName}...`);
  const buffer = await readFile(filePath);
  const uploadUrl =
    release.upload_url.replace('{?name,label}', '') +
    `?name=${encodeURIComponent(fileName)}`;

  const uploadStart = Date.now();
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(fileStats.size),
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text();
    fail(`Upload falhou (HTTP ${res.status}):\n${body.slice(0, 500)}`);
  }

  const elapsed = ((Date.now() - uploadStart) / 1000).toFixed(1);
  console.log(`✅ Upload concluído em ${elapsed}s`);
  console.log(`🔗 ${release.html_url}`);
}

async function findReleaseByTag(token, tag) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) fail(`GET release ${tag} falhou: HTTP ${res.status}`);
  return res.json();
}

async function createRelease(token, tag) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      body: '',
      draft: false,
      prerelease: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    fail(`POST release falhou (HTTP ${res.status}):\n${body.slice(0, 500)}`);
  }
  return res.json();
}

async function deleteAsset(token, assetId) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/assets/${assetId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  if (!res.ok && res.status !== 404) {
    fail(`DELETE asset falhou (HTTP ${res.status})`);
  }
}

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

main().catch((err) => fail(err.stack ?? err.message ?? String(err)));
