'use client';

import { Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export function PrintBar({ paperWidthMm }: { paperWidthMm: number }) {
  const tc = useTranslations('common');

  return (
    <div className="no-print flex flex-wrap items-center justify-center gap-3 py-4">
      <Button onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden />
        {tc('print')}
      </Button>
      <span className="text-sm text-muted-foreground">{paperWidthMm} mm</span>
    </div>
  );
}
