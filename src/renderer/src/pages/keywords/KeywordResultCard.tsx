import { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { KeywordResult, ScoreComponent } from '@shared/types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/cn';
import { SourceStatusBar } from './SourceStatusBar';
import { TrendsSparkline } from './TrendsSparkline';

interface KeywordResultCardProps {
  result: KeywordResult;
  onRefresh: () => void;
  busy?: boolean;
}

export function KeywordResultCard({ result, onRefresh, busy }: KeywordResultCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showTop, setShowTop] = useState(false);

  const score = result.score.value;
  const scoreColor =
    score === null
      ? 'text-zinc-500'
      : score >= 60
        ? 'text-emerald-500'
        : score >= 30
          ? 'text-amber-500'
          : 'text-red-500';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Palavra-chave
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{result.term}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            {result.cachedFromSearch ? 'Resultado do cache · ' : ''}
            Pesquisado em {new Date(result.searchedAt).toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className={cn('text-5xl font-semibold leading-none', scoreColor)}>
              {score === null ? '—' : score}
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-zinc-500">
              score / 100
            </div>
          </div>
          <Button onClick={onRefresh} disabled={busy} variant="secondary" size="sm">
            <RefreshCw className={cn('h-4 w-4', busy && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {result.score.explanation}
      </p>

      <div className="mt-4">
        <SourceStatusBar result={result} />
      </div>

      <CollapsibleSection
        title="Detalhamento do score"
        open={showBreakdown}
        onToggle={() => setShowBreakdown((s) => !s)}
      >
        <ScoreBreakdown components={result.score.components} />
      </CollapsibleSection>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KeywordsEverywhereCard result={result} />
        <ScrapingCard result={result} />
        <TrendsCard result={result} />
      </div>

      {result.scraping.data && (
        <CollapsibleSection
          title={`Top 10 do scraping (${result.scraping.data.topResults.length} vídeos)`}
          open={showTop}
          onToggle={() => setShowTop((s) => !s)}
        >
          <ol className="space-y-1 text-sm">
            {result.scraping.data.topResults.map((r) => {
              const href = r.videoId
                ? `https://www.youtube.com/watch?v=${r.videoId}`
                : null;
              const content = (
                <>
                  <span className="w-5 shrink-0 text-right text-xs text-zinc-500">
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium group-hover:text-red-600 dark:group-hover:text-red-400">
                      {r.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.channelName} · {formatViews(r.viewCount)} visualizações ·{' '}
                      {formatAge(r.publishedAt)}
                    </p>
                  </div>
                </>
              );
              return (
                <li key={r.position}>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-baseline gap-3 rounded-md px-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                      title="Abrir no YouTube"
                    >
                      {content}
                    </a>
                  ) : (
                    <div className="flex items-baseline gap-3 rounded-md px-2 py-1">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CollapsibleSection>
      )}
    </Card>
  );
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">{children}</div>}
    </div>
  );
}

function ScoreBreakdown({ components }: { components: ScoreComponent[] }) {
  if (components.length === 0) {
    return <p className="text-sm text-zinc-500">Sem componentes para exibir.</p>;
  }
  return (
    <div className="space-y-2">
      {components.map((c) => (
        <div key={`${c.source}-${c.name}`} className="text-sm">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{c.name}</span>
            <span className="text-xs text-zinc-500">
              {Math.round(c.normalizedValue)}/100 · peso {(c.weight * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full bg-zinc-700 dark:bg-zinc-300"
              style={{ width: `${c.normalizedValue}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function KeywordsEverywhereCard({ result }: { result: KeywordResult }) {
  const data = result.keywordsEverywhere.data;
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Volume de busca
      </p>
      {data ? (
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="Volume mensal" value={data.volume.toLocaleString('pt-BR')} />
          <Row label="CPC" value={`US$ ${data.cpc.toFixed(2)}`} />
          <Row label="Dificuldade" value={`${data.difficultyScore}/100`} />
        </dl>
      ) : (
        <UnavailableMessage status={result.keywordsEverywhere.status} message={result.keywordsEverywhere.errorMessage} />
      )}
    </div>
  );
}

function ScrapingCard({ result }: { result: KeywordResult }) {
  const data = result.scraping.data;
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Scraping próprio
      </p>
      {data ? (
        <dl className="mt-2 space-y-1.5 text-sm">
          <Row label="Concorrência" value={`${Math.round(data.competitionScore)}/100`} />
          <Row label="Idade média do top" value={`${Math.round(data.averageAgeDays)} dias`} />
          <Row label="Vídeos com >500k views" value={`${data.highViewCountInTop} de 10`} />
          <Row label="Visualizações médias" value={formatViews(data.averageViewsTop)} />
        </dl>
      ) : (
        <UnavailableMessage status={result.scraping.status} message={result.scraping.errorMessage} />
      )}
    </div>
  );
}

function TrendsCard({ result }: { result: KeywordResult }) {
  const data = result.trends.data;
  return (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Google Trends
      </p>
      {data ? (
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            {trendIcon(data.trendDirection)}
            <span className="font-medium">{trendLabel(data.trendDirection)}</span>
            <span className="ml-auto text-xs text-zinc-500">
              {data.trendScore}/100
            </span>
          </div>
          <TrendsSparkline series={data.timeSeries} />
          {data.risingQueries.length > 0 && (
            <div>
              <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Em ascensão:
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                {data.risingQueries.slice(0, 5).map((q) => (
                  <li key={q}>· {q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <UnavailableMessage status={result.trends.status} message={result.trends.errorMessage} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function UnavailableMessage({
  status,
  message,
}: {
  status: 'disabled' | 'unavailable' | 'error' | 'ok';
  message: string | null;
}) {
  const label =
    status === 'disabled'
      ? 'Desativado nas configurações'
      : status === 'error'
        ? 'Erro ao consultar'
        : 'Indisponível';
  return (
    <div className="mt-3 rounded-md bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
      <p className="font-medium">{label}</p>
      {message && <p className="mt-0.5 text-zinc-500">{message}</p>}
    </div>
  );
}

function trendIcon(direction: 'rising' | 'stable' | 'declining') {
  if (direction === 'rising') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (direction === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-zinc-500" />;
}

function trendLabel(direction: 'rising' | 'stable' | 'declining'): string {
  return direction === 'rising' ? 'Subindo' : direction === 'declining' ? 'Caindo' : 'Estável';
}

function formatViews(views: number): string {
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k`;
  return String(views);
}

function formatAge(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 30) return `${days} dias atrás`;
  if (days < 365) return `${Math.round(days / 30)} meses atrás`;
  return `${Math.round(days / 365)} ano${days >= 730 ? 's' : ''} atrás`;
}
