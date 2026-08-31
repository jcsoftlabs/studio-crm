'use client';

import { useState } from 'react';
import { DataTable } from './column-chart';

export type RankedRow = { key: string; label: string; value: number; valueLabel: string };

/**
 * Comparer des grandeurs entre quelques entités nommées : barres horizontales,
 * une seule teinte. L'identité est portée par l'étiquette, jamais par la couleur.
 */
export function RankedBars({
  rows,
  title,
  emptyLabel,
  tableLabel,
  valueHeader,
}: {
  rows: RankedRow[];
  title: string;
  emptyLabel: string;
  tableLabel: string;
  valueHeader: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <figure className="m-0 flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-col gap-1"
            onMouseEnter={() => setHover(row.key)}
            onMouseLeave={() => setHover(null)}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{row.valueLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-chart-track">
              <div
                className="h-full rounded-full transition-opacity"
                style={{
                  width: `${Math.max(2, (row.value / max) * 100)}%`,
                  backgroundColor: 'var(--color-chart-series)',
                  opacity: hover === null || hover === row.key ? 1 : 0.5,
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <DataTable
        rows={rows.map((row) => [row.label, row.valueLabel] as [string, string])}
        headers={[title, valueHeader]}
        label={tableLabel}
      />
    </figure>
  );
}
