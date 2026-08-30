'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { addDaysToDay, todayInStudio } from '@/lib/agenda';
import { cn } from '@/lib/utils';

export function DateNav({
  day,
  view,
  label,
}: {
  day: string;
  view: 'day' | 'week';
  label: string;
}) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const step = view === 'week' ? 7 : 1;

  const link = (nextDay: string, nextView: 'day' | 'week' = view) => ({
    pathname,
    query: { day: nextDay, view: nextView },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="outline" size="icon" aria-label={t('previous')}>
        <Link href={link(addDaysToDay(day, -step))}>
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      </Button>
      <Button asChild variant="outline" size="icon" aria-label={t('next')}>
        <Link href={link(addDaysToDay(day, step))}>
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={link(todayInStudio())}>{t('today')}</Link>
      </Button>

      <span className="px-1 text-sm font-medium">{label}</span>

      <div className="ml-auto hidden rounded-md border border-border p-0.5 md:inline-flex">
        {(['day', 'week'] as const).map((candidate) => (
          <Button
            key={candidate}
            asChild
            size="sm"
            variant={candidate === view ? 'default' : 'ghost'}
            className={cn()}
          >
            <Link href={link(day, candidate)} aria-current={candidate === view ? 'page' : undefined}>
              {t(candidate)}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
