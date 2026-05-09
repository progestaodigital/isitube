import { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: Array<{ date: string; value: number | null }>;
}

interface LineChartProps {
  series: LineSeries[];
  height?: number;
  yLabel?: string;
  formatY?: (n: number) => string;
  emptyState?: string;
}

const PADDING = { top: 16, right: 16, bottom: 28, left: 56 };

export function LineChart({
  series,
  height = 260,
  yLabel,
  formatY = (n) => n.toLocaleString('pt-BR'),
  emptyState = 'Sem dados ainda. Os pontos aparecem conforme você atualiza os canais.',
}: LineChartProps) {
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  const [width, setWidth] = useState(640);

  // Compute domain across all series.
  const { minTime, maxTime, minValue, maxValue, hasData } = useMemo(() => {
    let minTime = Infinity;
    let maxTime = -Infinity;
    let minValue = Infinity;
    let maxValue = -Infinity;
    let count = 0;
    for (const s of series) {
      for (const p of s.points) {
        if (p.value === null) continue;
        const t = new Date(p.date).getTime();
        if (Number.isNaN(t)) continue;
        if (t < minTime) minTime = t;
        if (t > maxTime) maxTime = t;
        if (p.value < minValue) minValue = p.value;
        if (p.value > maxValue) maxValue = p.value;
        count += 1;
      }
    }
    return {
      minTime,
      maxTime,
      minValue,
      maxValue,
      hasData: count > 0,
    };
  }, [series]);

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-6 text-center text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40"
        style={{ height }}
      >
        {emptyState}
      </div>
    );
  }

  const innerWidth = Math.max(width - PADDING.left - PADDING.right, 100);
  const innerHeight = Math.max(height - PADDING.top - PADDING.bottom, 60);

  // Pad value range a bit so points don't sit on the edges.
  const valuePad = (maxValue - minValue) * 0.08 || maxValue * 0.08 || 1;
  const yMin = Math.max(0, minValue - valuePad);
  const yMax = maxValue + valuePad;

  const xScale = (t: number) =>
    minTime === maxTime
      ? PADDING.left + innerWidth / 2
      : PADDING.left + ((t - minTime) / (maxTime - minTime)) * innerWidth;
  const yScale = (v: number) =>
    PADDING.top + innerHeight - ((v - yMin) / (yMax - yMin || 1)) * innerHeight;

  const yTicks = makeTicks(yMin, yMax, 4);
  const xTicks = makeXTicks(minTime, maxTime, 5);

  return (
    <div
      className="relative w-full"
      ref={(el) => {
        if (el && el.clientWidth !== width) setWidth(el.clientWidth);
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
      >
        {/* Gridlines + Y axis labels */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
            <text
              x={PADDING.left - 8}
              y={yScale(v) + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              opacity={0.6}
            >
              {formatY(v)}
            </text>
          </g>
        ))}

        {/* X axis labels */}
        {xTicks.map((t) => (
          <text
            key={t}
            x={xScale(t)}
            y={height - 8}
            textAnchor="middle"
            fontSize="10"
            fill="currentColor"
            opacity={0.6}
          >
            {formatDateShort(t)}
          </text>
        ))}

        {/* Lines + dots per series */}
        {series.map((s) => {
          const valid = s.points.filter((p) => p.value !== null);
          if (valid.length === 0) return null;
          const dimmed = hoveredSeries !== null && hoveredSeries !== s.id;
          const path = valid
            .map((p, i) => {
              const x = xScale(new Date(p.date).getTime());
              const y = yScale(p.value!);
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
            })
            .join(' ');
          return (
            <g
              key={s.id}
              opacity={dimmed ? 0.2 : 1}
              style={{ transition: 'opacity 120ms' }}
            >
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={hoveredSeries === s.id ? 2.5 : 1.75}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {valid.map((p, i) => (
                <circle
                  key={i}
                  cx={xScale(new Date(p.date).getTime())}
                  cy={yScale(p.value!)}
                  r={hoveredSeries === s.id ? 3.5 : 2.5}
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}

        {yLabel && (
          <text
            x={12}
            y={PADDING.top - 4}
            fontSize="10"
            fill="currentColor"
            opacity={0.6}
          >
            {yLabel}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s) => {
          const last = [...s.points].reverse().find((p) => p.value !== null);
          return (
            <button
              key={s.id}
              onMouseEnter={() => setHoveredSeries(s.id)}
              onMouseLeave={() => setHoveredSeries(null)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-opacity',
                hoveredSeries !== null && hoveredSeries !== s.id && 'opacity-40'
              )}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
              {last && (
                <span className="text-[11px] text-zinc-500">
                  · {formatY(last.value!)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function makeTicks(min: number, max: number, count: number): number[] {
  if (max === min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function makeXTicks(minTime: number, maxTime: number, count: number): number[] {
  if (minTime === maxTime) return [minTime];
  const step = (maxTime - minTime) / (count - 1);
  return Array.from({ length: count }, (_, i) => minTime + step * i);
}

function formatDateShort(t: number): string {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const CHART_PALETTE = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];
