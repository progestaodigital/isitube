import { useEffect, useState } from 'react';
import { Eye, EyeOff, ExternalLink, HelpCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusDot } from '../../components/ui/StatusDot';
import { useRouterStore } from '../../stores/router';
import { useHelpStore, type HelpTopic } from '../../stores/help';
import type { CredentialProvider, CredentialStatus } from '@shared/types';

interface CredentialFieldProps {
  provider: CredentialProvider;
  label: string;
  placeholder?: string;
  /** URL externa pra "Como obter sua chave?". Usado quando helpTopic não está definido. */
  helpUrl?: string;
  /** Tópico do wiki interno. Quando definido, sobrescreve helpUrl — o link
   *  "Como obter sua chave?" navega pra Ajuda → tópico específico em vez de
   *  abrir uma página externa. Mais contexto, menos saltos. */
  helpTopic?: HelpTopic;
}

type Feedback = { kind: 'ok' | 'err'; text: string } | null;

export function CredentialField({
  provider,
  label,
  placeholder = 'sk-...',
  helpUrl,
  helpTopic,
}: CredentialFieldProps) {
  const navigate = useRouterStore((s) => s.navigate);
  const setHelpTopic = useHelpStore((s) => s.setTopic);
  const [value, setValue] = useState('');
  const [showing, setShowing] = useState(false);
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function refresh() {
    const all = await window.api.credentials.list();
    setStatus(all.find((c) => c.provider === provider) ?? null);
  }

  useEffect(() => {
    refresh();
  }, [provider]);

  async function handleSave() {
    if (!value.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const setRes = await window.api.credentials.set(provider, value);
      if (!setRes.success) {
        setFeedback({ kind: 'err', text: setRes.message });
        await refresh();
        return;
      }
      // Auto-validação: testa a chave logo após salvar pra reduzir cliques
      // (Pro user cadastra 3 chaves seguidas, fazer Salvar + Testar pra cada
      // virava 6 cliques; agora vira 3). Se falhar, mostra a mensagem do
      // teste — o usuário sabe se a chave que ele acabou de colar é boa.
      setValue('');
      const testRes = await window.api.credentials.test(provider);
      setFeedback({ kind: testRes.success ? 'ok' : 'err', text: testRes.message });
      await refresh();
    } catch (err) {
      setFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Falha ao salvar a chave.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await window.api.credentials.test(provider);
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
      await window.api.credentials.delete(provider);
      await refresh();
      setFeedback({ kind: 'ok', text: 'Chave removida.' });
    } finally {
      setBusy(false);
    }
  }

  const hasValue = status?.hasValue ?? false;
  const lastValidated = status?.lastValidatedAt
    ? new Date(status.lastValidatedAt).toLocaleString('pt-BR')
    : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span>{label}</span>
          {status && (
            <StatusDot status={status.status} />
          )}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showing ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={hasValue ? '••••••••••••• (chave salva)' : placeholder}
              className="pr-10"
              disabled={busy}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowing((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              aria-label={showing ? 'Ocultar chave' : 'Mostrar chave'}
              tabIndex={-1}
            >
              {showing ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button onClick={handleSave} disabled={busy || !value.trim()} variant="primary">
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {hasValue && (
          <>
            <Button onClick={handleTest} disabled={busy} variant="secondary" size="sm">
              {busy ? 'Testando...' : 'Testar conexão'}
            </Button>
            <Button onClick={handleDelete} disabled={busy} variant="danger" size="sm">
              Remover
            </Button>
          </>
        )}
        {helpTopic ? (
          <button
            onClick={() => {
              setHelpTopic(helpTopic);
              navigate('help');
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Como obter sua chave?
            <HelpCircle className="h-3 w-3" />
          </button>
        ) : helpUrl ? (
          <a
            href={helpUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Como obter sua chave?
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>

      {lastValidated && (
        <p className="text-xs text-zinc-500">Última validação: {lastValidated}</p>
      )}

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
  );
}
