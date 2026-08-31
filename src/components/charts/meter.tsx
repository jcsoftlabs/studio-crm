/**
 * Un ratio unique face à une limite : une jauge, pas un camembert à deux parts.
 */
export function Meter({
  label,
  valueLabel,
  ratio,
  hint,
}: {
  label: string;
  valueLabel: string;
  ratio: number;
  hint?: string;
}) {
  const clamped = Math.min(1, Math.max(0, ratio));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{valueLabel}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-chart-track"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped * 100}%`, backgroundColor: 'var(--color-chart-series)' }}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
