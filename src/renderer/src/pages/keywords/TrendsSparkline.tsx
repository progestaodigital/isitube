import type { TrendsTimeSeriesPoint } from '@shared/types';

interface TrendsSparklineProps {
  series: TrendsTimeSeriesPoint[];
  height?: number;
}

export function TrendsSparkline({ series, height = 60 }: TrendsSparklineProps) {
  if (series.length === 0) return null;

  const width = 240;
  const padding = 4;
  const max = Math.max(...series.map((p) => p.value), 100);
  const min = 0;
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (series.length - 1);
  const points = series
    .map((p, i) => {
      const x = padding + i * stepX;
      const y = padding + (height - padding * 2) * (1 - (p.value - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPoints =
    `${padding},${height - padding} ` +
    points +
    ` ${(width - padding).toFixed(1)},${height - padding}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full max-w-xs"
      preserveAspectRatio="none"
    >
      <polygon points={areaPoints} fill="rgb(139 92 246 / 0.15)" />
      <polyline
        points={points}
        fill="none"
        stroke="rgb(139 92 246)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
