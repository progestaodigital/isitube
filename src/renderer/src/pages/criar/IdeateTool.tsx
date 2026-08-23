import { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  BarChart3,
  Trash2,
  KanbanSquare,
  Check,
} from 'lucide-react';
import type {
  IdeateInput,
  SavedVideoIdea,
  VideoIdeaLevel,
  VideoIdeaTrend,
  VideoIdeaUrgency,
  VideoIdeaTrafficStrategy,
  VideoIdeaVolumeTier,
} from '@shared/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { cn } from '../../lib/cn';
import { useRouterStore } from '../../stores/router';

const textareaClass = cn(
  'w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors',
  'placeholder:text-zinc-400 focus:outline-none',
  'border-zinc-300 focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-500',
  'dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500'
);

/** Quebra um textarea em linhas não-vazias. */
function lines(value: string): string[] {
  return value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return String(views);
}

export function IdeateTool() {
  const [niche, setNiche] = useState('');
  const [topVideos, setTopVideos] = useState('');
  const [pains, setPains] = useState('');
  const [avoid, setAvoid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<SavedVideoIdea[]>([]);
  const [channel, setChannel] = useState<{ title: string | null; count: number } | null>(null);

  // Carrega as ideias já salvas (persistem entre sessões).
  useEffect(() => {
    window.api.ideas
      .list()
      .then(setIdeas)
      .catch(() => {
        /* silencioso — lista vazia é estado válido */
      });
  }, []);

  // Se há canal conectado, puxa os top vídeos reais (com retenção) e pré-preenche
  // o campo. Não sobrescreve nada que o usuário já tenha digitado.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await window.api.youtube.status();
        if (cancelled || !status.connected) return;
        const insights = await window.api.youtube.getInsights(90);
        if (cancelled) return;
        const titles = insights.topVideos
          .filter((v) => v.title)
          .slice(0, 8)
          .map(
            (v) =>
              `${v.title} — ${formatViews(v.views)} views, ${Math.round(v.averageViewPercentage)}% retenção`
          );
        setChannel({ title: status.channelTitle, count: titles.length });
        if (titles.length > 0) {
          setTopVideos((cur) => (cur.trim() ? cur : titles.join('\n')));
        }
      } catch {
        // canal não conectado ou Analytics indisponível — segue manual.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function generate() {
    if (!niche.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const input: IdeateInput = {
        niche: niche.trim(),
        topVideos: lines(topVideos),
        audiencePainPoints: lines(pains),
        avoid: avoid.trim() || undefined,
      };
      const res = await window.api.ideas.generate(input);
      setIdeas((cur) => [...res.ideas, ...cur]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar ideias.');
    } finally {
      setBusy(false);
    }
  }

  function removeIdea(id: string) {
    setIdeas((cur) => cur.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-6">
      {channel && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <BarChart3 className="h-4 w-4 shrink-0" />
          <span>
            Puxamos os dados do seu canal
            {channel.title ? ` “${channel.title}”` : ''} — {channel.count} vídeo
            {channel.count !== 1 ? 's' : ''} mais forte{channel.count !== 1 ? 's' : ''} já no campo
            abaixo (edite à vontade).
          </span>
        </div>
      )}

      <Card>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Nicho do canal <span className="text-red-500">*</span>
            </label>
            <Input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex.: micro SaaS pra criadores solo, review de café especial…"
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Vídeos que mais performaram{' '}
                <span className="text-zinc-400">(opcional, um por linha)</span>
              </label>
              <textarea
                value={topVideos}
                onChange={(e) => setTopVideos(e.target.value)}
                placeholder={'Como validei meu SaaS em 7 dias\nErrei em 3 lançamentos, aprenda comigo'}
                rows={3}
                className={textareaClass}
                disabled={busy}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Dores da audiência <span className="text-zinc-400">(opcional, uma por linha)</span>
              </label>
              <textarea
                value={pains}
                onChange={(e) => setPains(e.target.value)}
                placeholder={'Não sei precificar\nMedo de lançar e ninguém comprar'}
                rows={3}
                className={textareaClass}
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Temas a evitar <span className="text-zinc-400">(opcional)</span>
            </label>
            <Input
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              placeholder="Ex.: nada de cripto, nada de política"
              disabled={busy}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={busy || !niche.trim()} variant="primary">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {busy ? 'Gerando ideias…' : 'Gerar ideias'}
            </Button>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </Card>

      {ideas.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">
            Ideias salvas ({ideas.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onDeleted={removeIdea} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IdeaCard({
  idea,
  onDeleted,
}: {
  idea: SavedVideoIdea;
  onDeleted: (id: string) => void;
}) {
  const navigateToKeywordSearch = useRouterStore((s) => s.navigateToKeywordSearch);
  const navigate = useRouterStore((s) => s.navigate);
  const [cardState, setCardState] = useState<'idle' | 'creating' | 'created' | 'error'>('idle');
  const [deleting, setDeleting] = useState(false);

  const scoreColor =
    idea.score >= 30 ? 'text-emerald-500' : idea.score >= 20 ? 'text-amber-500' : 'text-zinc-400';

  async function createCard() {
    setCardState('creating');
    try {
      await window.api.ideas.createCard(idea.id);
      setCardState('created');
    } catch {
      setCardState('error');
    }
  }

  async function del() {
    setDeleting(true);
    try {
      await window.api.ideas.delete(idea.id);
      onDeleted(idea.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="shrink-0 text-center">
          <div className={cn('text-2xl font-semibold leading-none', scoreColor)}>{idea.score}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">/40</div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug">{idea.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral">{TRAFFIC_LABELS[idea.trafficStrategy]}</Badge>
            <Badge tone={LEVEL_TONE[idea.competition]}>
              conc. {LEVEL_LABELS[idea.competition]}
            </Badge>
            <Badge tone="neutral">vol. {VOLUME_LABELS[idea.volumeTier]}</Badge>
            <TrendBadge trend={idea.trendDirection} />
            <Badge tone="neutral">{idea.contentLengthMin} min</Badge>
            <Badge tone={URGENCY_TONE[idea.urgency]}>{URGENCY_LABELS[idea.urgency]}</Badge>
          </div>
        </div>
      </div>

      <dl className="mt-3 space-y-2 text-sm">
        <Field label="Gancho" value={idea.hookAngle} />
        <Field label="Thumbnail" value={idea.thumbnailConcept} />
        <Field label="Por quê" value={idea.whyThisIdea} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Button
          onClick={() => navigateToKeywordSearch(idea.keyword)}
          variant="ghost"
          size="sm"
          title={`Analisar "${idea.keyword}"`}
        >
          <Search className="h-3.5 w-3.5" />
          Analisar
        </Button>

        {cardState === 'created' ? (
          <Button onClick={() => navigate('kanban')} variant="secondary" size="sm">
            <Check className="h-3.5 w-3.5 text-emerald-500" />
            Ver no Kanban
          </Button>
        ) : (
          <Button onClick={createCard} disabled={cardState === 'creating'} variant="secondary" size="sm">
            {cardState === 'creating' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <KanbanSquare className="h-3.5 w-3.5" />
            )}
            Criar card no Kanban
          </Button>
        )}

        <button
          onClick={del}
          disabled={deleting}
          title="Apagar ideia"
          className="ml-auto rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/50"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>

      {cardState === 'error' && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Não consegui criar o card. Tente de novo.
        </p>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">{value}</dd>
    </div>
  );
}

type Tone = 'neutral' | 'emerald' | 'amber' | 'red';

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  const toneClass: Record<Tone, string> = {
    neutral: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        toneClass[tone]
      )}
    >
      {children}
    </span>
  );
}

function TrendBadge({ trend }: { trend: VideoIdeaTrend }) {
  if (trend === 'subindo') {
    return (
      <Badge tone="emerald">
        <TrendingUp className="h-3 w-3" /> subindo
      </Badge>
    );
  }
  if (trend === 'caindo') {
    return (
      <Badge tone="red">
        <TrendingDown className="h-3 w-3" /> caindo
      </Badge>
    );
  }
  return (
    <Badge tone="neutral">
      <Minus className="h-3 w-3" /> estável
    </Badge>
  );
}

const TRAFFIC_LABELS: Record<VideoIdeaTrafficStrategy, string> = {
  busca: 'Busca',
  navegacao: 'Navegação',
  tendencia: 'Tendência',
};

const LEVEL_LABELS: Record<VideoIdeaLevel, string> = {
  baixa: 'baixa',
  media: 'média',
  alta: 'alta',
};

const LEVEL_TONE: Record<VideoIdeaLevel, Tone> = {
  baixa: 'emerald',
  media: 'amber',
  alta: 'red',
};

const VOLUME_LABELS: Record<VideoIdeaVolumeTier, string> = {
  baixo: 'baixo',
  medio: 'médio',
  alto: 'alto',
};

const URGENCY_LABELS: Record<VideoIdeaUrgency, string> = {
  semana: 'fazer essa semana',
  evergreen: 'evergreen',
  sazonal: 'sazonal',
};

const URGENCY_TONE: Record<VideoIdeaUrgency, Tone> = {
  semana: 'red',
  evergreen: 'neutral',
  sazonal: 'amber',
};
