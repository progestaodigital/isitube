import { useEffect, useState } from 'react';
import { Download, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

type UpdateInfo = {
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
 * Badge no header que checa por uma nova versão no GitHub uma vez por sessão.
 * Quando há update, mostra o botão pulsando; clique abre modal com release
 * notes e link pra baixar o instalador.
 */
export function UpdateBadge() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check após pequeno delay pra não bloquear o boot.
    const t = setTimeout(() => {
      window.api.updates
        .check()
        .then(setInfo)
        .catch(() => setInfo(null));
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!info || (!info.isNewer && !info.error)) return null;

  const hasUpdate = info.isNewer && info.assetUrl;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          hasUpdate
            ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700'
            : 'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }
        title={
          hasUpdate
            ? `Versão ${info.latestVersion} disponível`
            : info.error ?? 'Sem nova versão'
        }
      >
        {hasUpdate ? (
          <>
            <Download className="h-4 w-4" />
            <span>v{info.latestVersion}</span>
          </>
        ) : (
          <AlertCircle className="h-5 w-5 text-zinc-400" />
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Atualização disponível" size="md">
        <div className="space-y-4">
          {info.isNewer ? (
            <>
              <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-3 text-xs dark:bg-blue-950/30">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    Versão {info.latestVersion} disponível
                  </p>
                  <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                    Você está na versão {info.currentVersion}.{' '}
                    {info.publishedAt &&
                      `Publicada em ${new Date(info.publishedAt).toLocaleString('pt-BR')}.`}
                  </p>
                </div>
              </div>

              {info.releaseNotes && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    O que mudou
                  </p>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    {info.releaseNotes}
                  </pre>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Auto-update completo (download e instalação) chega em uma versão
                  futura. Por enquanto, baixa o instalador e roda — seus dados ficam
                  intactos porque o app guarda em outro local.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold">Você está na versão mais recente</p>
                <p className="mt-0.5">{info.currentVersion}</p>
              </div>
            </div>
          )}

          {info.error && (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {info.error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)} variant="ghost" size="sm">
              Fechar
            </Button>
            {hasUpdate && info.assetUrl && (
              <>
                <Button
                  onClick={() => window.api.updates.openUrl(info.releaseUrl!)}
                  variant="secondary"
                  size="sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver no GitHub
                </Button>
                <Button
                  onClick={() => window.api.updates.openUrl(info.assetUrl!)}
                  variant="primary"
                  size="sm"
                >
                  <Download className="h-4 w-4" />
                  Baixar instalador
                  {info.assetSize && (
                    <span className="ml-1 opacity-70">
                      ({(info.assetSize / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
