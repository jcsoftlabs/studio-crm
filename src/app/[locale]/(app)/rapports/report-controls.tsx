'use client';

import { useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ReportControls({ from, to }: { from: string; to: string }) {
  const t = useTranslations('rapports');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const [range, setRange] = useState({ from, to });

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden">
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
      <Button variant="outline" onClick={() => router.push({ pathname: '/rapports', query: range })}>
        {tc('apply')}
      </Button>
      <Button asChild variant="outline">
        <a href={`/${locale}/rapports/export?from=${range.from}&to=${range.to}`}>
          <Download className="size-4" aria-hidden />
          {t('exportCsv')}
        </a>
      </Button>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        {t('exportPdf')}
      </Button>
    </div>
  );
}
