import { useEffect, useState } from 'react';
import {
  Download,
  Upload,
  ShieldAlert,
  Github,
  Cloud,
  CloudUpload,
  RotateCcw,
  ExternalLink,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { Section } from './Section';
import { CredentialField } from './CredentialField';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToastStore } from '../../stores/toast';
import { isCredentialReady, useCredentialStatus } from '../../hooks/useCredentialStatus';
import type {
  BackupInspectResult,
  GithubBackupConfig,
  GithubBackupRelease,
  GithubRepoInfo,
} from '@shared/types';

export function BackupSection() {
  const showToast = useToastStore((s) => s.show);
  const githubCred = useCredentialStatus('github');
  const githubReady = isCredentialReady(githubCred);

  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirm, setConfirm] = useState<BackupInspectResult | null>(null);

  // GitHub state
  const [config, setConfig] = useState<GithubBackupConfig | null>(null);
  const [repoInput, setRepoInput] = useState('');
  const [releases, setReleases] = useState<GithubBackupRelease[] | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState<GithubBackupRelease | null>(null);

  // Repo dropdown state
  const [repoList, setRepoList] = useState<GithubRepoInfo[] | null>(null);
  const [repoListLoading, setRepoListLoading] = useState(false);
  const [repoFilter, setRepoFilter] = useState('');

  async function refreshConfig() {
    const c = await window.api.backup.githubGetConfig();
    setConfig(c);
    if (c.repo && !repoInput) setRepoInput(c.repo);
  }

  useEffect(() => {
    refreshConfig();
  }, []);

  useEffect(() => {
    return window.api.events.onCredentialsChanged((p) => {
      if (p.provider === 'github') refreshConfig();
    });
  }, []);

  async function handleExport() {
    setBusy(true);
    try {
      const result = await window.api.backup.export();
      if (result.success) {
        showToast({ kind: 'success', title: 'Backup salvo', description: result.path });
      } else if (result.message !== 'Backup cancelado.') {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePickToRestore() {
    setBusy(true);
    try {
      const result = await window.api.backup.inspect();
      if (result.success && result.filePath) {
        setConfirm(result);
      } else if (result.message !== 'Seleção cancelada.') {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmRestore() {
    if (!confirm?.filePath) return;
    setRestoring(true);
    try {
      const result = await window.api.backup.restore(confirm.filePath);
      if (result.success) {
        showToast({ kind: 'success', title: 'Restaurado', description: result.message });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setRestoring(false);
      setConfirm(null);
    }
  }

  async function handleSaveRepo() {
    try {
      await window.api.backup.githubSetConfig(repoInput);
      await refreshConfig();
      showToast({ kind: 'success', title: 'Repositório salvo' });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleLoadRepos() {
    setRepoListLoading(true);
    try {
      const result = await window.api.backup.githubListRepos();
      if (result.success && result.repos) {
        setRepoList(result.repos);
        if (result.repos.length === 0) {
          showToast({
            kind: 'info',
            title: 'Sem repositórios',
            description: 'Crie um repositório no GitHub primeiro.',
          });
        }
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setRepoListLoading(false);
    }
  }

  async function handleGithubUpload() {
    setBusy(true);
    try {
      const result = await window.api.backup.githubUpload();
      if (result.success) {
        showToast({
          kind: 'success',
          title: 'Backup enviado pra GitHub',
          description: result.releaseUrl,
        });
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleGithubList() {
    setListLoading(true);
    setListOpen(true);
    try {
      const result = await window.api.backup.githubList();
      if (result.success) {
        setReleases(result.releases ?? []);
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
        setListOpen(false);
      }
    } finally {
      setListLoading(false);
    }
  }

  async function handleConfirmGithubRestore() {
    if (!confirmRelease) return;
    setRestoring(true);
    try {
      const result = await window.api.backup.githubRestore(confirmRelease.id);
      if (result.success) {
        showToast({ kind: 'success', title: 'Restaurado do GitHub', description: result.message });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast({ kind: 'error', title: 'Falha', description: result.message });
      }
    } finally {
      setRestoring(false);
      setConfirmRelease(null);
      setListOpen(false);
    }
  }

  const githubFullyConfigured = githubReady && config?.repo;

  return (
    <Section
      title="Backup e restauração"
      description="Exporte seus dados (canais, vídeos, transcrições, palavras-chave, snapshots) num .zip. Suas chaves de API NÃO entram no backup. Você decide quando."
    >
      {/* LOCAL */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <Download className="mt-0.5 h-5 w-5 text-emerald-500" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Backup local (arquivo .zip)</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Salva onde você quiser: OneDrive, pendrive, GitHub manualmente.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleExport} disabled={busy} variant="primary" size="sm">
                <Download className="h-4 w-4" />
                Exportar agora
              </Button>
              <Button
                onClick={handlePickToRestore}
                disabled={busy}
                variant="secondary"
                size="sm"
              >
                <Upload className="h-4 w-4" />
                Restaurar de arquivo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* GITHUB */}
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <Github className="mt-0.5 h-5 w-5 text-zinc-700 dark:text-zinc-300" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-semibold">Sync com GitHub Releases</p>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Cada backup vira uma Release no seu repositório (versionado, ilimitado em quantidade).
                Recomendamos um repositório <b>privado</b> dedicado, ex: <code>seunick/isitube-backup</code>.
                Token com scope <code>repo</code>.
              </p>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=isiTube%20backup"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
              >
                Gerar token no GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <CredentialField
              provider="github"
              label="GitHub Personal Access Token"
              placeholder="ghp_..."
              helpUrl="https://github.com/settings/tokens"
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Repositório (formato: owner/repo)
                </label>
                <button
                  type="button"
                  onClick={handleLoadRepos}
                  disabled={!githubReady || repoListLoading}
                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-400 disabled:no-underline dark:text-blue-400 dark:disabled:text-zinc-600"
                  title={githubReady ? 'Buscar repositórios na sua conta' : 'Cadastre e valide o token primeiro'}
                >
                  <RefreshCw className={`h-3 w-3 ${repoListLoading ? 'animate-spin' : ''}`} />
                  {repoListLoading ? 'Carregando...' : 'Buscar do GitHub'}
                </button>
              </div>

              {repoList && repoList.length > 0 && (
                <div className="mb-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <Input
                    value={repoFilter}
                    onChange={(e) => setRepoFilter(e.target.value)}
                    placeholder={`Filtrar entre ${repoList.length} repos...`}
                    className="mb-2 h-7 text-xs"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <div className="max-h-48 overflow-y-auto">
                    {repoList
                      .filter((r) =>
                        repoFilter.trim()
                          ? r.fullName.toLowerCase().includes(repoFilter.toLowerCase())
                          : true
                      )
                      .slice(0, 50)
                      .map((r) => {
                        const selected = repoInput === r.fullName;
                        return (
                          <button
                            key={r.fullName}
                            type="button"
                            onClick={() => setRepoInput(r.fullName)}
                            className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
                              selected
                                ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {r.private && (
                                <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                              )}
                              <span className="truncate font-mono">{r.fullName}</span>
                            </span>
                            <span className="shrink-0 text-[10px] text-zinc-500">
                              {new Date(r.pushedAt).toLocaleDateString('pt-BR')}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-zinc-500">
                    Recomendado: privado. Clique para selecionar.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="seunick/isitube-backup"
                  className="flex-1"
                  spellCheck={false}
                  autoComplete="off"
                />
                <Button
                  onClick={handleSaveRepo}
                  disabled={!repoInput.trim()}
                  variant="primary"
                  size="sm"
                >
                  Salvar
                </Button>
              </div>
              {config?.repo && (
                <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                  Configurado: {config.repo}
                </p>
              )}
            </div>

            {githubFullyConfigured ? (
              <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <Button
                  onClick={handleGithubUpload}
                  disabled={busy}
                  variant="primary"
                  size="sm"
                >
                  <CloudUpload className="h-4 w-4" />
                  {busy ? 'Enviando...' : 'Backup pra GitHub'}
                </Button>
                <Button onClick={handleGithubList} disabled={busy} variant="secondary" size="sm">
                  <Cloud className="h-4 w-4" />
                  Restaurar do GitHub
                </Button>
              </div>
            ) : (
              <p className="border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800">
                Cadastre token + repositório acima pra liberar os botões.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM LOCAL RESTORE */}
      <Modal
        open={Boolean(confirm)}
        onClose={() => !restoring && setConfirm(null)}
        title="Confirmar restauração"
        size="md"
      >
        {confirm?.manifest && (
          <ConfirmRestoreContent
            manifest={confirm.manifest}
            onCancel={() => setConfirm(null)}
            onConfirm={handleConfirmRestore}
            busy={restoring}
          />
        )}
      </Modal>

      {/* GITHUB RELEASES LIST */}
      <Modal
        open={listOpen}
        onClose={() => !restoring && setListOpen(false)}
        title="Backups no GitHub"
        size="lg"
      >
        {listLoading ? (
          <p className="py-8 text-center text-xs text-zinc-500">Carregando releases...</p>
        ) : !releases || releases.length === 0 ? (
          <div className="py-8 text-center">
            <Cloud className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700" />
            <p className="mt-3 text-sm font-medium">Nenhum backup encontrado</p>
            <p className="mt-1 text-xs text-zinc-500">
              Faça o primeiro upload com "Backup pra GitHub".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {releases.map((r) => (
              <button
                key={r.id}
                onClick={() => setConfirmRelease(r)}
                className="flex w-full items-start justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    {new Date(r.createdAt).toLocaleString('pt-BR')} · {(r.assetSize / 1024).toFixed(0)} KB
                  </p>
                  {r.manifest && (
                    <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                      {r.manifest.channelsCount} canais · {r.manifest.videosCount} vídeos ·{' '}
                      {r.manifest.keywordsCount} palavras-chave
                    </p>
                  )}
                </div>
                <RotateCcw className="mt-1 h-4 w-4 text-zinc-400" />
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* CONFIRM GITHUB RESTORE */}
      <Modal
        open={Boolean(confirmRelease)}
        onClose={() => !restoring && setConfirmRelease(null)}
        title="Confirmar restauração do GitHub"
        size="md"
      >
        {confirmRelease?.manifest && (
          <ConfirmRestoreContent
            manifest={confirmRelease.manifest}
            onCancel={() => setConfirmRelease(null)}
            onConfirm={handleConfirmGithubRestore}
            busy={restoring}
          />
        )}
        {confirmRelease && !confirmRelease.manifest && (
          <ConfirmRestoreContent
            manifest={null}
            onCancel={() => setConfirmRelease(null)}
            onConfirm={handleConfirmGithubRestore}
            busy={restoring}
            fallbackName={confirmRelease.name}
          />
        )}
      </Modal>
    </Section>
  );
}

function ConfirmRestoreContent({
  manifest,
  onCancel,
  onConfirm,
  busy,
  fallbackName,
}: {
  manifest: NonNullable<BackupInspectResult['manifest']> | null;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  fallbackName?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/40">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs text-amber-900 dark:text-amber-200">
          Isso vai <b>sobrescrever todos os seus dados atuais</b> com o conteúdo do backup. Suas
          chaves de API ficam intactas. Esta ação não tem volta — considere fazer um backup do
          estado atual antes.
        </p>
      </div>

      {manifest ? (
        <div className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-800">
          <p className="font-medium">O backup tem:</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-700 dark:text-zinc-300">
            <li>{manifest.channelsCount} canais</li>
            <li>{manifest.videosCount} vídeos</li>
            <li>{manifest.keywordsCount} palavras-chave</li>
            <li>{manifest.updateRunsCount} atualizações</li>
            <li>{manifest.channelSnapshotsCount} snapshots de canal</li>
            <li>{manifest.videoSnapshotsCount} snapshots de vídeo</li>
          </ul>
          <p className="mt-3 text-[11px] text-zinc-500">
            Criado em {new Date(manifest.createdAt).toLocaleString('pt-BR')} · versão{' '}
            {manifest.appVersion}
          </p>
        </div>
      ) : (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          Backup: {fallbackName ?? 'sem manifest'} (sem detalhes — vai aplicar mesmo assim)
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={busy} variant="primary" size="sm">
          {busy ? 'Restaurando...' : 'Sim, restaurar'}
        </Button>
      </div>
    </div>
  );
}
