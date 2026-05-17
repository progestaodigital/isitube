// One-shot helper: atualiza o body de uma release existente no GitHub com
// o conteúdo de um arquivo markdown local. Útil pra cola as release notes
// que o `publish-release.mjs` deixa em branco.
//
// Uso:
//   node --env-file=.env scripts/update-release-body.mjs <version> <markdown_path>
//   ex: node --env-file=.env scripts/update-release-body.mjs 0.4.0 dist/release-notes-0.4.0.md

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = 'progestaodigital/isitube';

async function main() {
  const version = process.argv[2];
  const mdPath = process.argv[3];
  if (!version || !mdPath) {
    fail('Uso: node --env-file=.env scripts/update-release-body.mjs <version> <markdown_path>');
  }
  const cleanVersion = version.replace(/^v/, '');
  const tag = `v${cleanVersion}`;
  const fullPath = resolve(__dirname, '..', mdPath);
  if (!existsSync(fullPath)) fail(`Arquivo não encontrado: ${fullPath}`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) fail('GITHUB_TOKEN não está em process.env. Roda com `node --env-file=.env`.');

  const body = await readFile(fullPath, 'utf-8');

  // 1. Pega a release pra obter o id
  const get = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${tag}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!get.ok) fail(`Não achei release ${tag}: HTTP ${get.status}`);
  const release = await get.json();
  console.log(`✓ Release ${tag} encontrada (id=${release.id})`);

  // 2. PATCH body
  const patch = await fetch(`https://api.github.com/repos/${REPO}/releases/${release.id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
  if (!patch.ok) {
    const errBody = await patch.text();
    fail(`PATCH falhou (HTTP ${patch.status}):\n${errBody.slice(0, 300)}`);
  }
  console.log(`✅ Body atualizado (${body.length} chars)`);
  console.log(`🔗 ${release.html_url}`);
}

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

main().catch((err) => fail(err.stack ?? err.message ?? String(err)));
