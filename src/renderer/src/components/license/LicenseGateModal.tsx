// Modal bloqueante que cobre o app quando a licença não está válida. Esta é
// a porta de entrada do isiTube — sem licença ativa, nenhuma feature funciona.
//
// Estados que disparam o modal:
//   - no_key            → 1ª execução, usuário precisa colar a chave
//   - invalid           → chave digitada errado ou não vinculada
//   - hwid_mismatch     → chave em uso em outra máquina
//   - expired           → licença passou da data
//   - blocked           → admin bloqueou
//   - expired_offline   → cache de validação expirou após 48h sem internet
//   - network_error     → falha de rede durante revalidação
//   - rate_limited      → muitas tentativas
//
// O modal NÃO tem botão de fechar — só desaparece quando uma chave válida é
// colada (valid: true) ou quando a revalidação automática (após network_error)
// volta com sucesso.

import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { presentLicenseStatus } from '../../lib/licenseErrors';
import type { LicenseInfo } from '@shared/types';

interface LicenseGateModalProps {
  info: LicenseInfo;
  submitting: boolean;
  onSubmit: (key: string) => Promise<LicenseInfo>;
  onRetry: () => Promise<LicenseInfo>;
}

// Regex matches o formato ISI-XXXX-XXXX-XXXX-XXXX com alfabeto sem 0/O/1/I/L.
const KEY_FORMAT = /^ISI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function LicenseGateModal({ info, submitting, onSubmit, onRetry }: LicenseGateModalProps) {
  const [value, setValue] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [lastSubmitResult, setLastSubmitResult] = useState<LicenseInfo | null>(null);

  // Reset input quando o usuário transita entre erros (ex: digitou chave
  // inválida → status muda). Mantém o valor digitado em network_error.
  useEffect(() => {
    if (info.status === 'no_key' || info.status === 'invalid' || info.status === 'hwid_mismatch') {
      setLastSubmitResult(info);
    }
  }, [info.status]);

  // Mostra a mensagem mais informativa: o resultado do último submit (se houve)
  // ou o estado atual da licença.
  const presented = presentLicenseStatus(lastSubmitResult?.status ?? info.status);
  const reason = lastSubmitResult?.reason ?? info.reason;

  const normalized = normalizeKey(value);
  const formatOk = KEY_FORMAT.test(normalized);

  async function handleSubmit() {
    if (!formatOk || submitting) return;
    const result = await onSubmit(normalized);
    setLastSubmitResult(result);
    if (result.valid) {
      // Modal será desmontado pelo App pelo `info.valid === true` — apenas
      // limpa estado local pra evitar flash de "chave salva" quando ele
      // remontar (não deveria, mas defensive).
      setValue('');
    }
  }

  async function handleRetry() {
    setRetrying(true);
    try {
      const result = await onRetry();
      setLastSubmitResult(result);
    } finally {
      setRetrying(false);
    }
  }

  function openExternal(url: string) {
    // Electron's window.open is captured by main and rerouted to shell.openExternal.
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const isTransient =
    info.status === 'network_error' ||
    info.status === 'rate_limited' ||
    info.status === 'expired_offline';
  const isFirstUse = info.status === 'no_key';

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-gate-title"
    >
      <div className="animate-modal-in relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <div
            className={
              'flex h-10 w-10 items-center justify-center rounded-full ' +
              (isFirstUse
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400')
            }
          >
            {isFirstUse ? <KeyRound className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <h2 id="license-gate-title" className="text-base font-semibold">
              {presented.title}
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              isiTube · validação de licença
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{presented.description}</p>

          {reason && reason !== presented.description && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
              {reason}
            </p>
          )}

          {/* Input + submit — mostrado em estados que aceitam nova chave */}
          {!isTransient && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Chave de licença
              </label>
              <Input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onPaste={(e) => {
                  // Após o paste o React atualiza via onChange; nada extra precisa.
                  void e;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formatOk && !submitting) handleSubmit();
                }}
                placeholder="ISI-XXXX-XXXX-XXXX-XXXX"
                disabled={submitting}
                spellCheck={false}
                autoComplete="off"
                className="font-mono text-sm tracking-wider"
              />
              <p className="text-[11px] text-zinc-500">
                {normalized.length === 0
                  ? 'Cole exatamente como veio no email.'
                  : formatOk
                  ? 'Formato OK — clique em validar.'
                  : 'Formato inválido. Esperado: ISI-XXXX-XXXX-XXXX-XXXX.'}
              </p>
            </div>
          )}

          {/* Botões — variam por estado */}
          <div className="flex flex-wrap items-center gap-2">
            {!isTransient && (
              <Button
                onClick={handleSubmit}
                disabled={!formatOk || submitting}
                variant="primary"
                size="md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    Validar
                  </>
                )}
              </Button>
            )}

            {presented.actions.includes('retry') && (
              <Button onClick={handleRetry} disabled={retrying} variant="primary" size="md">
                {retrying ? 'Tentando...' : 'Tentar novamente'}
              </Button>
            )}

            {presented.actions.includes('subscription') && info.subscriptionUrl && (
              <Button
                onClick={() => openExternal(info.subscriptionUrl!)}
                variant="secondary"
                size="md"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Renovar
              </Button>
            )}

            {presented.actions.includes('support') && info.supportUrl && (
              <Button
                onClick={() => openExternal(info.supportUrl!)}
                variant="ghost"
                size="md"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Suporte
              </Button>
            )}
          </div>

          {/* Rodapé com info técnica resumida */}
          <div className="border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800">
            Sua chave é encriptada localmente. Ela nunca é enviada além do painel isipanel.
          </div>
        </div>
      </div>
    </div>
  );
}
