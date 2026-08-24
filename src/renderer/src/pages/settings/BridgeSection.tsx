import { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import type { BridgeStatus } from '@shared/types';
import { cn } from '../../lib/cn';

export function BridgeSection() {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function refresh() {
    try {
      setStatus(await window.api.bridge.status());
    } catch {
      /* silencioso */
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggle() {
    if (!status) return;
    setBusy(true);
    try {
      setStatus(await window.api.bridge.setEnabled(!status.enabled));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    setBusy(true);
    try {
      setStatus(await window.api.bridge.regenerateToken());
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const baseUrl = status ? `http://${status.host}:${status.port}` : '';

  return (
    <Section
      title="Integração MCP (Claude Code)"
      description="Expõe a Biblioteca e o Kanban num bridge local (127.0.0.1, protegido por token) pra um MCP do Claude Code ler, criar, preencher e mover cards. Só responde com o isiTube aberto."
    >
      {!status ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : (
        <div className="space-y-4">
          {/* Liga/desliga + estado */}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={toggle} disabled={busy} variant={status.enabled ? 'secondary' : 'primary'}>
              {status.enabled ? 'Desativar bridge' : 'Ativar bridge'}
            </Button>
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  status.running ? 'bg-emerald-500' : 'bg-zinc-400'
                )}
              />
              {status.running ? `Rodando em ${baseUrl}` : 'Parado'}
            </span>
          </div>

          {status.enabled && (
            <>
              {/* Endpoint */}
              <Field label="Endereço (base URL)">
                <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                  {baseUrl}
                </code>
                <CopyBtn onClick={() => copy(baseUrl, 'url')} copied={copied === 'url'} />
              </Field>

              {/* Token */}
              <Field label="Token (Bearer)">
                <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-800">
                  {showToken ? status.token : '•'.repeat(32)}
                </code>
                <button
                  onClick={() => setShowToken((v) => !v)}
                  className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title={showToken ? 'Ocultar' : 'Mostrar'}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <CopyBtn onClick={() => copy(status.token, 'token')} copied={copied === 'token'} />
                <button
                  onClick={regenerate}
                  disabled={busy}
                  className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
                  title="Gerar novo token (invalida o anterior)"
                >
                  <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
                </button>
              </Field>

              <div className="rounded-lg bg-zinc-100 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
                <p className="font-medium">Como o MCP usa:</p>
                <p className="mt-1">
                  Configure o servidor MCP com <code className="font-mono">ISITUBE_BASE_URL={baseUrl}</code> e{' '}
                  <code className="font-mono">ISITUBE_TOKEN=&lt;token acima&gt;</code>. Todas as
                  chamadas exigem o header <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
                  Rotas: <code className="font-mono">GET /library</code>,{' '}
                  <code className="font-mono">GET /kanban/board</code>,{' '}
                  <code className="font-mono">GET /kanban/card/:id</code>,{' '}
                  <code className="font-mono">POST /kanban/card</code>,{' '}
                  <code className="font-mono">PATCH /kanban/card/:id</code>,{' '}
                  <code className="font-mono">POST /kanban/card/:id/move</code>.
                </p>
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  Mantenha o token privado — quem tiver ele (e acesso a esta máquina) pode ler/editar
                  seus cards.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function CopyBtn({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      title="Copiar"
    >
      {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
