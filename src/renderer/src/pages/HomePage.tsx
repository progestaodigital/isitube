import { useCallback, useEffect, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { MissingKeyCTA } from '../components/ui/MissingKeyCTA';
import {
  Tv,
  Search,
  FileText,
  Sparkles,
  Wand2,
  TrendingUp,
  Flame,
  Sprout,
  RefreshCw,
  CalendarClock,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { useRouterStore } from '../stores/router';
import { isCredentialReady, useCredentialStatus } from '../hooks/useCredentialStatus';
import { useVideoDetailStore } from '../stores/videoDetail';
import { useToastStore } from '../stores/toast';
import type {
  ChannelInfo,
  EvergreenVideo,
  FreeKeywordIdeasResult,
  KeywordIdeasResult,
  ScheduleInfo,
  UpdateRunInfo,
  VideoDetail,
  VideoInfo,
} from '@shared/types';
import { cn } from '../lib/cn';

interface DashboardData {
  channels: ChannelInfo[];
  flagged: VideoInfo[];
  evergreen: EvergreenVideo[];
  extracted: VideoDetail[];
  latestRun: UpdateRunInfo | null;
  schedule: ScheduleInfo | null;
}

export function HomePage() {
  const navigate = useRouterStore((s) => s.navigate);
  const showToast = useToastStore((s) => s.show);

  const [data, setData] = useState<DashboardData | null>(null);
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    const [channels, flagged, evergreen, extracted, runs, schedule] = await Promise.all([
      window.api.channels.list(),
      window.api.channels.getFlaggedVideos({ minPercent: 150 }),
      window.api.channels.analyticsEvergreen({ minViewsPerDay: 1 }),
      window.api.videos.listExtracted({}),
      window.api.channels.listUpdateRuns(1),
      window.api.schedule.get(),
    ]);
    setData({
      channels,
      flagged,
      evergreen,
      extracted,
      latestRun: runs[0] ?? null,
      schedule,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const off = window.api.events.onUpdateRunCompleted(() => refresh());
    return off;
  }, [refresh]);

  async function handleUpdateAll() {
    if (updating) return;
    setUpdating(true);
    try {
      const run = await window.api.channels.updateAll('manual');
      showToast({
        kind: run.status === 'failed' ? 'error' : 'success',
        title: run.status === 'failed' ? 'Atualização falhou' : 'Atualização concluída',
        description:
          run.status === 'failed' && run.errorMessage
            ? run.errorMessage
            : `${run.videosNew} novos vídeos · ${run.videosFlagged} sinalizados.`,
      });
      await refresh();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Resumo do seu monitoramento e atalhos pros módulos.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard
          icon={Tv}
          value={data?.channels.length ?? 0}
          label="canais monitorados"
          tint="red"
          onClick={() => navigate('channels')}
        />
        <MetricCard
          icon={Sparkles}
          value={data ? data.flagged.length : 0}
          label="vídeos em destaque"
          tint="amber"
          onClick={() => navigate('channels')}
        />
        <MetricCard
          icon={Sprout}
          value={data ? data.evergreen.length : 0}
          label="vídeos evergreen"
          tint="emerald"
          onClick={() => navigate('channels')}
        />
        <MetricCard
          icon={FileText}
          value={data ? data.extracted.length : 0}
          label="vídeos extraídos"
          tint="blue"
          onClick={() => navigate('videos')}
        />
      </div>

      <StatusCard
        latestRun={data?.latestRun ?? null}
        schedule={data?.schedule ?? null}
        channels={data?.channels.length ?? 0}
        updating={updating}
        onUpdate={handleUpdateAll}
        onAddChannel={() => navigate('channels')}
        onSchedule={() => navigate('channels')}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TopList
          icon={Flame}
          title="Top vídeos em destaque"
          tint="text-amber-600 dark:text-amber-400"
          empty="Nenhum vídeo sinalizado ainda. Atualize seus canais."
          videos={data?.flagged.slice(0, 5) ?? []}
          renderRight={(v) => (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {Math.round(v.outlierPercent ?? 0)}%
            </span>
          )}
          onSeeMore={() => navigate('channels')}
        />
        <TopList
          icon={Sprout}
          title="Top vídeos evergreen"
          tint="text-emerald-600 dark:text-emerald-400"
          empty="Sem evergreen ainda. Precisa de pelo menos 2 atualizações em dias diferentes."
          videos={
            data?.evergreen.slice(0, 5).map((e) => ({
              id: e.id,
              youtubeId: e.youtubeId,
              channelId: e.channelId,
              channelTitle: e.channelTitle,
              title: e.title,
              thumbnailUrl: e.thumbnailUrl,
              viewCount: e.totalViewCount,
              likeCount: null,
              commentCount: null,
              durationSec: null,
              publishedAt: e.publishedAt,
              channelAvgViewsAtCheck: null,
              outlierPercent: null,
              flaggedAsOutlier: false,
            })) ?? []
          }
          renderRight={(v) => {
            const ev = data?.evergreen.find((e) => e.id === v.id);
            return ev ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                {formatCompact(ev.viewsPerDay)}/dia
              </span>
            ) : null;
          }}
          onSeeMore={() => navigate('channels')}
        />
      </div>

      <AIDemo />

      <Card className="bg-zinc-100/50 dark:bg-zinc-900/50">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-zinc-500" />
          <div>
            <p className="text-sm font-medium">isiTube · MVP completo</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Todas as APIs reais conectadas. Dados em tempo real assim que você cadastra os
              canais e configura suas chaves.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  tint,
  onClick,
}: {
  icon: typeof Tv;
  value: number;
  label: string;
  tint: 'red' | 'amber' | 'emerald' | 'blue';
  onClick?: () => void;
}) {
  const tintClasses = {
    red: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
  }[tint];

  const Body = (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', tintClasses)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className="text-left">
        <Card className="cursor-pointer transition-colors hover:border-zinc-400 dark:hover:border-zinc-600">
          {Body}
        </Card>
      </button>
    );
  }
  return <Card>{Body}</Card>;
}

function StatusCard({
  latestRun,
  schedule,
  channels,
  updating,
  onUpdate,
  onAddChannel,
  onSchedule,
}: {
  latestRun: UpdateRunInfo | null;
  schedule: ScheduleInfo | null;
  channels: number;
  updating: boolean;
  onUpdate: () => void;
  onAddChannel: () => void;
  onSchedule: () => void;
}) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {latestRun && latestRun.completedAt ? (
          <span>
            Última atualização:{' '}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {new Date(latestRun.completedAt).toLocaleString('pt-BR')}
            </span>{' '}
            · {latestRun.videosNew} novos · {latestRun.videosFlagged} sinalizados
          </span>
        ) : (
          <span>Sem atualizações ainda.</span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" />
          {schedule
            ? `próxima ${new Date(schedule.scheduledAt).toLocaleString('pt-BR')}`
            : 'sem agendamento'}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {channels === 0 && (
          <Button onClick={onAddChannel} variant="primary" size="sm">
            <Plus className="h-4 w-4" />
            Cadastrar primeiro canal
          </Button>
        )}
        <Button onClick={onUpdate} disabled={updating || channels === 0} size="sm">
          <RefreshCw className={cn('h-4 w-4', updating && 'animate-spin')} />
          {updating ? 'Atualizando...' : 'Atualizar agora'}
        </Button>
        <Button onClick={onSchedule} variant="ghost" size="sm">
          <CalendarClock className="h-4 w-4" />
          Agendar
        </Button>
      </div>
    </Card>
  );
}

function TopList({
  icon: Icon,
  title,
  tint,
  empty,
  videos,
  renderRight,
  onSeeMore,
}: {
  icon: typeof Flame;
  title: string;
  tint: string;
  empty: string;
  videos: VideoInfo[];
  renderRight: (v: VideoInfo) => React.ReactNode;
  onSeeMore: () => void;
}) {
  const open = useVideoDetailStore((s) => s.open);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${tint}`} />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <button
          onClick={onSeeMore}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ver tudo <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      {videos.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {videos.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => open(v.id)}
                className="flex w-full items-center gap-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
              >
                {v.thumbnailUrl && (
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-medium">{v.title}</p>
                  <p className="text-[11px] text-zinc-500">{v.channelTitle ?? '—'}</p>
                </div>
                <div className="shrink-0">{renderRight(v)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return Math.round(n).toString();
}

type Mode = 'free' | 'ai';

function AIDemo() {
  const anthropic = useCredentialStatus('anthropic');
  const aiReady = isCredentialReady(anthropic);

  const [mode, setMode] = useState<Mode>('free');
  const [seed, setSeed] = useState('receitas fitness');
  const [aiResult, setAiResult] = useState<KeywordIdeasResult | null>(null);
  const [freeResult, setFreeResult] = useState<FreeKeywordIdeasResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!seed.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'ai') {
        const res = await window.api.ai.generateKeywordIdeas(seed.trim());
        setAiResult(res);
      } else {
        const res = await window.api.keywords.generateFreeIdeas(seed.trim());
        setFreeResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha desconhecida');
    } finally {
      setBusy(false);
    }
  }

  const blockedByMissingKey = mode === 'ai' && !aiReady;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400">
          <Wand2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">Gerar ideias de palavra-chave</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {mode === 'ai'
              ? '5 ideias com justificativa, dificuldade e volume — geradas pelo Claude.'
              : 'Até 25 sugestões instantâneas do autocomplete do YouTube + queries em ascensão do Trends. Sem IA, sem custo.'}
          </p>
        </div>
        <ModeToggle mode={mode} onChange={setMode} />
      </div>

      {blockedByMissingKey ? (
        <div className="mt-4">
          <MissingKeyCTA
            provider="anthropic"
            status={anthropic}
            feature="Modo IA do gerador de ideias"
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <Input
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
              placeholder="Tema (ex: receitas fitness, marcenaria, finanças pessoais)"
              className="flex-1"
              disabled={busy}
            />
            <Button onClick={handleGenerate} disabled={busy || !seed.trim()} variant="primary">
              {busy ? 'Gerando...' : mode === 'ai' ? 'Gerar 5 ideias' : 'Buscar ideias'}
            </Button>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {mode === 'ai' && aiResult && <AIResults result={aiResult} />}
          {mode === 'free' && freeResult && <FreeResults result={freeResult} />}
        </>
      )}
    </Card>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex shrink-0 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
      <button
        onClick={() => onChange('free')}
        className={cn(
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          mode === 'free'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        )}
      >
        Sem IA
      </button>
      <button
        onClick={() => onChange('ai')}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
          mode === 'ai'
            ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
        )}
      >
        <Wand2 className="h-3 w-3" />
        Com IA
      </button>
    </div>
  );
}

function FreeResults({ result }: { result: FreeKeywordIdeasResult }) {
  if (result.ideas.length === 0) {
    return (
      <p className="mt-4 text-xs text-zinc-500">
        Nenhuma sugestão encontrada para esse termo. Tente algo mais comum ou específico.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {result.ideas.map((idea, i) => (
          <span
            key={`${idea.term}-${i}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs',
              idea.source === 'autocomplete'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400'
            )}
          >
            {idea.source === 'trends' && <TrendingUp className="h-3 w-3" />}
            {idea.term}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">
        {result.ideas.length} sugestões em {result.meta.durationMs}ms · fontes:{' '}
        {result.meta.sources.length > 0
          ? result.meta.sources
              .map((s) => (s === 'autocomplete' ? 'autocomplete' : 'tendências'))
              .join(' + ')
          : 'nenhuma'}
      </p>
    </div>
  );
}

function AIResults({ result }: { result: KeywordIdeasResult }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="space-y-2">
        {result.ideas.map((idea, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/30"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{idea.term}</p>
              <div className="flex shrink-0 gap-1.5">
                <DifficultyBadge level={idea.estimatedDifficulty} />
                <VolumeBadge level={idea.estimatedVolume} />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              {idea.rationale}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">
        Gerado em {result.meta.durationMs}ms via provider{' '}
        <span className="font-mono">{result.meta.provider}</span>
        {result.meta.model ? ` (${result.meta.model})` : ''}.
      </p>
    </div>
  );
}

function DifficultyBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const classes = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    high: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  }[level];
  const label = { low: 'Dif. baixa', medium: 'Dif. média', high: 'Dif. alta' }[level];
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', classes)}>
      {label}
    </span>
  );
}

function VolumeBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const classes = {
    low: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    high: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  }[level];
  const label = { low: 'Vol. baixo', medium: 'Vol. médio', high: 'Vol. alto' }[level];
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', classes)}>
      {label}
    </span>
  );
}
