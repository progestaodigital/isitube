import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Link2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToastStore } from '../stores/toast';
import { useLicense } from '../hooks/useLicense';
import { LineChart, CHART_PALETTE } from '../components/charts/LineChart';
import type {
  ChannelAuditResult,
  YoutubeChannelSummary,
  YoutubeConnectionStatus,
  YoutubeInsights,
  YoutubeTopVideo,
  YoutubeTrafficSource,
} from '@shared/types';

export function MeuCanalPage() {
  const showToast = useToastStore((s) => s.show);
  const { info } = useLicense();
  const isPro = info?.valid && info.plan === 'pro';

  const [status, setStatus] = useState<YoutubeConnectionStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [editingConfig, setEditingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    const s = await window.api.youtube.status();
    setStatus(s);
    setEditingConfig(!s.hasConfig);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSaveConfig() {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setSavingConfig(true);
    try {
      const s = await window.api.youtube.setConfig(clientId.trim(), clientSecret.trim());
      setStatus(s);
      setClientId('');
      setClientSecret('');
      setEditingConfig(false);
      showToast({
        kind: 'success',
        title: 'Credenciais salvas',
        description: 'Agora clique em "Conectar meu canal".',
      });
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao salvar',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      showToast({
        kind: 'info',
        title: 'Abrindo o navegador…',
        description: 'Autorize o isiTube na sua conta Google e volte pro app.',
      });
      const res = await window.api.youtube.connect();
      if (res.success) {
        if (res.status) setStatus(res.status);
        else await refresh();
        showToast({ kind: 'success', title: res.message });
      } else {
        showToast({ kind: 'error', title: 'Não conectou', description: res.message });
      }
    } catch (err) {
      showToast({
        kind: 'error',
        title: 'Falha ao conectar',
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm('Desconectar o canal? Suas credenciais (Client ID/Secret) continuam salvas.'))
      return;
    await window.api.youtube.disconnect();
    await refresh();
    showToast({ kind: 'info', title: 'Canal desconectado' });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Meu canal</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Conecte seu canal do YouTube pra puxar os relatórios reais (retenção, CTR, tempo de
          exibição, inscritos, receita) e liberar a auditoria com IA.
        </p>
      </header>

      {info && !isPro ? (
        <UpsellPro subscriptionUrl={info.subscriptionUrl} />
      ) : (
        <>
          {status?.needsReconnect && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <p className="text-xs text-amber-900 dark:text-amber-200">
                A conexão expirou (o app OAuth em modo Teste expira a cada 7 dias). Clique em{' '}
                <b>Conectar meu canal</b> pra reconectar.
              </p>
            </div>
          )}

          {status?.connected ? (
            <>
              <ConnectedCard
                status={status}
                onDisconnect={handleDisconnect}
                onReconnect={handleConnect}
                connecting={connecting}
              />
              <ChannelDashboard />
            </>
          ) : editingConfig || !status?.hasConfig ? (
            <ConfigForm
              clientId={clientId}
              clientSecret={clientSecret}
              setClientId={setClientId}
              setClientSecret={setClientSecret}
              onSave={handleSaveConfig}
              saving={savingConfig}
              canCancel={status?.hasConfig ?? false}
              onCancel={() => setEditingConfig(false)}
            />
          ) : (
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Credenciais OAuth salvas</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Client ID e Secret cadastrados. Falta autorizar sua conta Google.
                  </p>
                </div>
                <Button onClick={() => setEditingConfig(true)} variant="ghost" size="sm">
                  Trocar
                </Button>
              </div>
              <div className="mt-4">
                <Button onClick={handleConnect} disabled={connecting} variant="primary">
                  {connecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {connecting ? 'Aguardando autorização…' : 'Conectar meu canal'}
                </Button>
              </div>
            </Card>
          )}

          <InstructionsCard />
        </>
      )}
    </div>
  );
}

function ConfigForm({
  clientId,
  clientSecret,
  setClientId,
  setClientSecret,
  onSave,
  saving,
  canCancel,
  onCancel,
}: {
  clientId: string;
  clientSecret: string;
  setClientId: (v: string) => void;
  setClientSecret: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  canCancel: boolean;
  onCancel: () => void;
}) {
  return (
    <Card>
      <h2 className="text-lg font-semibold">Credenciais OAuth (do seu projeto Google)</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Cole o <b>Client ID</b> e o <b>Client Secret</b> do cliente OAuth tipo "App para computador"
        que você criou no mesmo projeto Google do YouTube. Ficam criptografados neste computador.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Client ID
          </label>
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="...apps.googleusercontent.com"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Client Secret
          </label>
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="GOCSPX-..."
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onSave}
            disabled={saving || !clientId.trim() || !clientSecret.trim()}
            variant="primary"
          >
            {saving ? 'Salvando…' : 'Salvar credenciais'}
          </Button>
          {canCancel && (
            <Button onClick={onCancel} variant="secondary">
              Cancelar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function ConnectedCard({
  status,
  onDisconnect,
  onReconnect,
  connecting,
}: {
  status: YoutubeConnectionStatus;
  onDisconnect: () => void;
  onReconnect: () => void;
  connecting: boolean;
}) {
  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{status.channelTitle ?? 'Canal conectado'}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Conectado{' '}
            {status.connectedAt
              ? `em ${new Date(status.connectedAt).toLocaleString('pt-BR')}`
              : ''}{' '}
            · leitura de Analytics autorizada.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={onReconnect} disabled={connecting} variant="secondary" size="sm">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Reconectar
            </Button>
            <Button onClick={onDisconnect} variant="ghost" size="sm">
              Desconectar
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function ChannelDashboard() {
  const [days, setDays] = useState(28);
  const [summary, setSummary] = useState<YoutubeChannelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<ChannelAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [insights, setInsights] = useState<YoutubeInsights | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    window.api.youtube
      .getSummary(days)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    setInsights(null);
    window.api.youtube
      .getInsights(days)
      .then((i) => {
        if (!cancelled) setInsights(i);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [days]);

  async function handleAudit() {
    setAuditing(true);
    setAuditError(null);
    try {
      const a = await window.api.youtube.audit(days);
      setAudit(a);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuditing(false);
    }
  }

  const netSubs = summary ? summary.subscribersGained - summary.subscribersLost : 0;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Desempenho do canal</h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleAudit}
            disabled={auditing || loading || !summary}
            variant="primary"
            size="sm"
          >
            {auditing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {auditing ? 'Analisando…' : 'Auditar com IA'}
          </Button>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={28}>Últimos 28 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
        </div>
      </div>

      {loading && <p className="mt-4 text-sm text-zinc-500">Carregando métricas do YouTube…</p>}
      {error && !loading && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {summary && !loading && !error && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard label="Visualizações" value={fmtInt(summary.views)} />
            <StatCard label="Tempo de exibição" value={fmtWatch(summary.estimatedMinutesWatched)} />
            <StatCard label="Retenção média" value={fmtPct(summary.averageViewPercentage)} />
            <StatCard label="Duração média (AVD)" value={fmtDuration(summary.averageViewDuration)} />
            <StatCard
              label="Inscritos (líquido)"
              value={`${netSubs >= 0 ? '+' : ''}${fmtInt(netSubs)}`}
              sub={`+${fmtInt(summary.subscribersGained)} / −${fmtInt(summary.subscribersLost)}`}
            />
            <StatCard label="Curtidas" value={fmtInt(summary.likes)} />
            <StatCard label="Comentários" value={fmtInt(summary.comments)} />
            <StatCard
              label="Receita estimada"
              value={summary.estimatedRevenue != null ? fmtMoney(summary.estimatedRevenue) : '—'}
              sub="moeda da conta AdSense"
            />
          </div>

          {summary.impressionCtr != null ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard label="CTR de impressões" value={fmtPct(summary.impressionCtr)} />
              {summary.impressions != null && (
                <StatCard label="Impressões" value={fmtInt(summary.impressions)} />
              )}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-zinc-500">
              CTR e impressões não são expostos pela API pública do YouTube — aparecem só no YouTube
              Studio.
            </p>
          )}

          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-zinc-500">Visualizações por dia</p>
            <LineChart
              series={[
                {
                  id: 'views',
                  label: 'Views/dia',
                  color: CHART_PALETTE[0],
                  points: summary.timeSeries.map((p) => ({ date: p.date, value: p.views })),
                },
              ]}
              height={220}
              emptyState="Sem dados no período."
            />
          </div>
        </>
      )}

      {insights && insights.topVideos.length > 0 && <TopVideosTable videos={insights.topVideos} />}
      {insights && insights.trafficSources.length > 0 && (
        <TrafficBreakdown sources={insights.trafficSources} />
      )}

      {auditError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {auditError}
        </div>
      )}
      {audit && <AuditReport audit={audit} />}
    </Card>
  );
}

function AuditReport({ audit }: { audit: ChannelAuditResult }) {
  return (
    <div className="mt-5 space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div>
        <div className="flex items-center gap-2">
          <VerdictBadge verdict={audit.verdict} />
          <span className="text-[10px] text-zinc-400">
            via {audit.meta.model ?? audit.meta.provider}
          </span>
        </div>
        <p className="mt-2 text-sm">{audit.summary}</p>
      </div>

      {audit.strengths.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Pontos fortes
          </p>
          <ul className="ml-4 list-disc space-y-0.5 text-sm">
            {audit.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {audit.findings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            O que corrigir
          </p>
          {audit.findings.map((f, i) => (
            <div
              key={i}
              className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <p className="text-sm font-medium">{f.title}</p>
              </div>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{f.detail}</p>
              <p className="mt-1 text-xs">
                <b>Ação:</b> {f.recommendation}
              </p>
            </div>
          ))}
        </div>
      )}

      {audit.quickWins.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Ganhos rápidos
          </p>
          <ul className="ml-4 list-disc space-y-0.5 text-sm">
            {audit.quickWins.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict.toLowerCase();
  const tone = v.includes('cr')
    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
    : v.includes('aten')
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{verdict}</span>;
}

function SeverityBadge({ severity }: { severity: 'alta' | 'media' | 'baixa' }) {
  const map: Record<string, string> = {
    alta: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    media: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    baixa: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${map[severity] ?? map.baixa}`}
    >
      {severity}
    </span>
  );
}

function TopVideosTable({ videos }: { videos: YoutubeTopVideo[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium text-zinc-500">
        Top vídeos (por views) — retenção por vídeo
      </p>
      <div className="space-y-1.5">
        {videos.map((v) => (
          <div
            key={v.videoId}
            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
          >
            {v.thumbnailUrl ? (
              <img src={v.thumbnailUrl} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-10 w-16 shrink-0 rounded bg-zinc-200 dark:bg-zinc-800" />
            )}
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-medium">{v.title ?? v.videoId}</p>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-zinc-500">
                <span>{fmtInt(v.views)} views</span>
                <span>AVD {fmtDuration(v.averageViewDuration)}</span>
                {v.subscribersGained > 0 && <span>+{fmtInt(v.subscribersGained)} inscritos</span>}
              </div>
            </div>
            <RetentionPill pct={v.averageViewPercentage} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RetentionPill({ pct }: { pct: number }) {
  const tone =
    pct >= 50
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      : pct >= 35
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
        : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
  return (
    <div className="shrink-0 text-right">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{fmtPct(pct)}</span>
      <p className="mt-0.5 text-[9px] text-zinc-400">retenção</p>
    </div>
  );
}

function TrafficBreakdown({ sources }: { sources: YoutubeTrafficSource[] }) {
  const total = sources.reduce((a, s) => a + s.views, 0) || 1;
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-medium text-zinc-500">Fontes de tráfego</p>
      <div className="space-y-1.5">
        {sources.slice(0, 8).map((s) => {
          const pct = (s.views / total) * 100;
          return (
            <div key={s.source}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
                <span className="text-zinc-500">
                  {fmtInt(s.views)} · {fmtPct(pct)}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-400">{sub}</p>}
    </div>
  );
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}
function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}
function fmtMoney(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
function fmtWatch(min: number): string {
  const hours = min / 60;
  if (hours >= 1) return `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} h`;
  return `${fmtInt(min)} min`;
}

function InstructionsCard() {
  return (
    <Card className="bg-zinc-50 dark:bg-zinc-900/40">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
        <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">Onde pegar Client ID/Secret</p>
          <ol className="mt-1 ml-4 list-decimal space-y-0.5">
            <li>
              No <b>mesmo projeto Google</b> do YouTube Data API, habilite a <b>YouTube Analytics
              API</b>.
            </li>
            <li>
              Tela de consentimento: adicione o escopo <code>yt-analytics.readonly</code> (e{' '}
              <code>yt-analytics-monetary.readonly</code> pra receita). Nome do app <b>sem</b>{' '}
              "YouTube"/"Tube".
            </li>
            <li>
              Credenciais → criar <b>ID do cliente OAuth</b> tipo <b>App para computador</b> → copie
              Client ID + Secret.
            </li>
            <li>Cole acima e clique em Conectar. O login abre no seu navegador.</li>
          </ol>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Abrir Credenciais do Google Cloud
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </Card>
  );
}

function UpsellPro({ subscriptionUrl }: { subscriptionUrl: string | null }) {
  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex items-start gap-3">
        <Crown className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Conectar o canal é um recurso Pro
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            Usa o OAuth do seu próprio projeto Google (BYOK). Faça upgrade pra puxar os relatórios
            reais do seu canal.
          </p>
          {subscriptionUrl && (
            <a
              href={subscriptionUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-700"
            >
              <Crown className="h-3 w-3" />
              Upgrade pro Pro
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
