'use client';

import { useId, useState } from 'react';

export type ColumnPoint = { key: string; label: string; value: number; valueLabel: string };

/**
 * Série unique dans le temps : une seule teinte, pas de légende — le titre
 * nomme la série. Étiquette directe sur le seul maximum, jamais sur tout.
 */
export function ColumnChart({
  points,
  title,
  emptyLabel,
  tableLabel,
  valueHeader,
}: {
  points: ColumnPoint[];
  title: string;
  emptyLabel: string;
  tableLabel: string;
  valueHeader: string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  const max = Math.max(...points.map((point) => point.value), 1);
  const peak = points.reduce((best, point, index) => (point.value > points[best].value ? index : best), 0);

  const width = 100;
  const height = 34;
  const gap = 1.4;
  const barWidth = Math.max(1.2, (width - gap * (points.length - 1)) / points.length);

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-labelledby={`${id}-title`}
          className="h-40 w-full"
        >
          <title id={`${id}-title`}>{title}</title>
          <line
            x1="0"
            y1={height}
            x2={width}
            y2={height}
            stroke="var(--color-chart-grid)"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
          {points.map((point, index) => {
            const barHeight = point.value === 0 ? 0.6 : (point.value / max) * (height - 2);
            const x = index * (barWidth + gap);
            return (
              <rect
                key={point.key}
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx="0.7"
                fill="var(--color-chart-series)"
                opacity={hover === null || hover === index ? 1 : 0.45}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
        </svg>

        {/* Cible de survol plus large que la barre, pour le doigt comme pour la souris. */}
        <div className="absolute inset-0 flex">
          {points.map((point, index) => (
            <button
              key={point.key}
              type="button"
              aria-label={`${point.label} : ${point.valueLabel}`}
              className="flex-1"
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
            />
          ))}
        </div>

        {hover !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-md border border-border bg-card px-2 py-1 text-xs shadow-sm"
          >
            <span className="font-medium">{points[hover].label}</span>{' '}
            <span className="text-muted-foreground">{points[hover].valueLabel}</span>
          </div>
        ) : null}
      </div>

      <figcaption className="flex justify-between text-xs text-muted-foreground">
        <span>{points[0].label}</span>
        <span className="font-medium text-foreground">{points[peak].valueLabel}</span>
        <span>{points[points.length - 1].label}</span>
      </figcaption>

      <DataTable
        rows={points.map((point) => [point.label, point.valueLabel])}
        headers={[title, valueHeader]}
        label={tableLabel}
      />
    </figure>
  );
}

export function DataTable({
  rows,
  headers,
  label,
}: {
  rows: [string, string][];
  headers: [string, string];
  label: string;
}) {
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">{label}</summary>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left">
            <th className="py-1 font-medium">{headers[0]}</th>
            <th className="py-1 text-right font-medium">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([left, right]) => (
            <tr key={left}>
              <td className="py-0.5">{left}</td>
              <td className="py-0.5 text-right">{right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
