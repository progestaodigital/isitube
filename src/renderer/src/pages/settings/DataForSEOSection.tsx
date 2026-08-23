import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Section } from './Section';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { CredentialStatus } from '@shared/types';

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

export function DataForSEOSection() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function refresh() {
    const all = await window.api.credentials.list();
    setStatus(all.find((c) => c.provider === 'dataforseo') ?? null);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSave() {
    if (!login.trim() || !password.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const value = JSON.stringify({ login: login.trim(), password: password.trim() });
      const setRes = await window.api.credentials.set('dataforseo', value);
      if (!setRes.success) {
        setFeedback({ kind: 'err', text: setRes.message });
        await refresh();
        return;
      }
      setLogin('');
      setPassword('');
      const testRes = await window.api.credentials.test('dataforseo');
      setFeedback({ kind: testRes.success ? 'ok' : 'err', text: testRes.message });
      await refresh();
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Falha ao salvar as credenciais.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await window.api.credentials.test('dataforseo');
      setFeedback({ kind: res.success ? 'ok' : 'err', text: res.message });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setFeedback(null);
    try {
      await window.api.credentials.delete('dataforseo');
      await refresh();
      setFeedback({ kind: 'ok', text: 'Credenciais removidas.' });
    } finally {
      setBusy(false);
    }
  }

  const hasValue = status?.hasValue ?? false;

  return (
    <Section
      title="DataForSEO"
      description="Volume de busca (clickstream, sem faixa), CPC e dificuldade de palavra-chave. Substitui o Keywords Everywhere quando configurado. Pay-as-you-go — centavos por keyword."
      status={status?.status}
    >
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Login (email da conta DataForSEO)
          </label>
          <Input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder={hasValue ? '••••••••••• (salvo)' : 'seu-email@exemplo.com'}
            spellCheck={false}
            autoComplete="off"
            disabled={busy}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Senha da API
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={hasValue ? '••••••••••• (salva)' : 'senha da API (painel DataForSEO)'}
            spellCheck={false}
            autoComplete="off"
            disabled={busy}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={busy || !login.trim() || !password.trim()}
            variant="primary"
          >
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
          {hasValue && (
            <>
              <Button onClick={handleTest} disabled={busy} variant="secondary" size="sm">
                Testar conexão
              </Button>
              <Button onClick={handleDelete} disabled={busy} variant="danger" size="sm">
                Remover
              </Button>
            </>
          )}
          <a
            href="https://app.dataforseo.com/api-access"
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Onde pegar login/senha?
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {feedback && (
          <p
            className={
              feedback.kind === 'ok'
                ? 'text-xs text-emerald-600 dark:text-emerald-400'
                : 'text-xs text-red-600 dark:text-red-400'
            }
          >
            {feedback.text}
          </p>
        )}
      </div>
    </Section>
  );
}
