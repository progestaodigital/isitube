import { useEffect, useState } from 'react';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  History,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useToastStore } from '../../stores/toast';

type UpdateInfo = {
  currentVersion: string;
  latestVersion: string | null;
  isNewer: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  assetUrl: string | null;
  assetSize: number | null;
  assetId: number | null;
  error: string | null;
};

type ReleaseSummary = {
  version: string;
  tagName: string;
  name: string;
  publishedAt: string;
  releaseUrl: string;
  releaseNotes: string | null;
  assetId: number | null;
  assetSize: number | null;
  isCurrent: boolean;
  isNewer: boolean;
  isOlder: boolean;
};

export function UpdateBadge() {
  const showToast = useToastStore((s) => s.show);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showOlder, setShowOlder] = useState(false);
  const [allReleases, setAllReleases] = useState<ReleaseSummary[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      window.api.updates
        .check()
        .then(setInfo)
        .catch(() => setInfo(null));
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  async function loadAllReleases() {
    if (allReleases !== null) return;
    setLoadingAll(true);
    try {
      const result = await window.api.updates.listAll();
      if (result.releases.length > 0) setAllReleases(result.releases);
      else setAllReleases([]);
    } finally {
      setLoadingAll(false);
    }
  }

  async function handleInstall(assetId: number, version: string) {
    setInstalling(true);
    try {
      const fileName = `isiTube-Setup-${version}.exe`;
      const result = await window.api.updates.downloadAndInstall(assetId, fileName);
      if (result.success) {
        showToast({
          kind: 'info',
          title: 'Aplicando atualização',
          description: 'O app vai fechar e o instalador abrir.',
        });
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
        setInstalling(false);
      }
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha',
        description: err instanceof Error ? err.message : String(err),
      });
      setInstalling(false);
    }
  }

  if (!info) return null;
  const hasUpdate = info.isNewer && typeof info.assetId === 'number';

  return (
    <>
      {hasUpdate ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          title={`Versão ${info.latestVersion} disponível`}
        >
          <Download className="h-4 w-4" />
          <span>Atualização disponível</span>
        </button>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            loadAllReleases();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Você está na versão mais recente"
        >
          <CheckCircle2 className="h-5 w-5 text-zinc-400" />
        </button>
      )}

      <Modal
        open={open}
        onClose={() => !installing && setOpen(false)}
        title={hasUpdate ? 'Atualização disponível' : `Você está em v${info.currentVersion}`}
        size="md"
      >
        <div className="space-y-4">
          {hasUpdate ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 text-xs dark:border-orange-900 dark:bg-orange-950/30">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                <div>
                  <p className="font-semibold text-orange-900 dark:text-orange-200">
                    Versão {info.latestVersion} disponível
                  </p>
                  <p className="mt-0.5 text-orange-800 dark:text-orange-300">
                    Você está na v{info.currentVersion}.{' '}
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
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-sans text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    {info.releaseNotes}
                  </pre>
                </div>
              )}

              <div className="flex items-start gap-2 rounded-lg bg-zinc-100 p-3 text-[11px] text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  Ao clicar em "Atualizar agora" o app baixa o instalador, fecha
                  sozinho e abre o wizard NSIS pra você confirmar a instalação. Seus
                  dados (canais, vídeos, configurações) ficam intactos — eles ficam
                  num diretório separado do install.
                </p>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-3 text-xs dark:bg-emerald-950/30">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="text-emerald-900 dark:text-emerald-200">
                <p className="font-semibold">Você está na versão mais recente</p>
                <p className="mt-0.5">v{info.currentVersion}</p>
              </div>
            </div>
          )}

          {info.error && (
            <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {info.error}
            </p>
          )}

          <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <button
              onClick={() => {
                setShowOlder((s) => !s);
                if (!showOlder) loadAllReleases();
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <History className="h-3.5 w-3.5" />
              {showOlder ? 'Esconder' : 'Ver outras versões (downgrade)'}
            </button>

            {showOlder && (
              <div className="mt-3 space-y-2">
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    <b>Downgrade pode quebrar dados.</b> Se a versão atual fez
                    migrations no banco que a versão antiga não conhece, o app pode
                    falhar ao abrir. Faça um <b>backup</b> em Configurações antes.
                  </p>
                </div>

                {loadingAll ? (
                  <p className="py-3 text-center text-xs text-zinc-500">Carregando...</p>
                ) : allReleases && allReleases.length > 0 ? (
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {allReleases.map((r) => {
                      const downloadable = typeof r.assetId === 'number' && !r.isCurrent;
                      return (
                        <div
                          key={r.tagName}
                          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
                            r.isCurrent
                              ? 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                              : 'border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <span className="font-mono font-semibold">v{r.version}</span>
                          {r.isCurrent && (
                            <span className="rounded-full bg-blue-200 px-1.5 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              atual
                            </span>
                          )}
                          {r.isNewer && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-orange-600">
                              <ArrowUp className="h-3 w-3" />
                              mais nova
                            </span>
                          )}
                          {r.isOlder && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-500">
                              <ArrowDown className="h-3 w-3" />
                              mais antiga
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-500">
                            {new Date(r.publishedAt).toLocaleDateString('pt-BR')}
                          </span>
                          {downloadable && typeof r.assetId === 'number' && (
                            <button
                              onClick={() => handleInstall(r.assetId!, r.version)}
                              disabled={installing}
                              className="ml-auto inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
                              title={r.isOlder ? 'Voltar pra essa versão' : 'Instalar essa versão'}
                            >
                              {r.isOlder ? 'Voltar' : 'Instalar'}
                            </button>
                          )}
                          {!downloadable && !r.isCurrent && (
                            <span className="ml-auto text-[10px] text-zinc-400">sem .exe</span>
                          )}
                          <button
                            onClick={() => window.api.updates.openUrl(r.releaseUrl)}
                            className="rounded p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                            title="Ver no GitHub"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-3 text-center text-xs text-zinc-500">
                    Nenhuma release encontrada.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)} variant="ghost" size="sm" disabled={installing}>
              Fechar
            </Button>
            {hasUpdate && typeof info.assetId === 'number' && info.latestVersion && (
              <>
                <Button
                  onClick={() => window.api.updates.openUrl(info.releaseUrl!)}
                  variant="secondary"
                  size="sm"
                  disabled={installing}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ver no GitHub
                </Button>
                <Button
                  onClick={() => handleInstall(info.assetId!, info.latestVersion!)}
                  variant="primary"
                  size="sm"
                  disabled={installing}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {installing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {installing ? 'Baixando...' : 'Atualizar agora'}
                  {info.assetSize && !installing && (
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
