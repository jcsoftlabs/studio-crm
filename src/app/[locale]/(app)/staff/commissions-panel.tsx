'use client';

import { useState, useTransition } from 'react';
import { Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { settleCommissions } from './actions';

export type CommissionRow = {
  employeeId: string;
  employeeName: string;
  count: number;
  /// Montants déjà formatés côté serveur : une fonction ne traverse pas la frontière.
  baseLabel: string;
  amountLabel: string;
};

export function CommissionsPanel({
  from,
  to,
  rows,
  pendingTotal,
}: {
  from: string;
  to: string;
  rows: CommissionRow[];
  pendingTotal: string;
}) {
  const t = useTranslations('commissions');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const router = useRouter();
  const [range, setRange] = useState({ from, to });
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">{tc('from')}</Label>
          <Input
            id="from"
            type="date"
            value={range.from}
            onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">{tc('to')}</Label>
          <Input
            id="to"
            type="date"
            value={range.to}
            onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
        <Button
          variant="outline"
          onClick={() => router.push({ pathname: '/staff', query: range })}
        >
          {tc('apply')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li key={row.employeeId} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="flex-1 truncate font-medium">{row.employeeName}</span>
                <span className="text-muted-foreground">
                  {t('base')} {row.baseLabel}
                </span>
                <span className="font-medium">{row.amountLabel}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">
              {t('pending')} : {pendingTotal}
            </span>
            <Button
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await settleCommissions(range.from, range.to);
                  if (result.error) setError(result.error);
                  else {
                    setError(null);
                    setSettled(rows.reduce((sum, row) => sum + row.count, 0));
                    router.refresh();
                  }
                })
              }
            >
              <Wallet className="size-4" aria-hidden />
              {pending ? tc('saving') : t('settle')}
            </Button>
            {settled !== null ? (
              <span className="text-sm text-muted-foreground">{t('settled', { count: settled })}</span>
            ) : null}
            {error ? (
              <span role="alert" className="text-sm text-destructive">
                {te(error as 'generic')}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
