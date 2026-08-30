'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type ReminderRow = {
  id: string;
  clientName: string;
  employeeName: string;
  time: string;
  message: string;
  link: string | null;
};

export function ReminderList({ rows }: { rows: ReminderRow[] }) {
  const t = useTranslations('agenda.reminder');

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Card>
            <CardContent className="flex flex-wrap items-start gap-3 pt-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {row.time} · {row.clientName}
                </p>
                <p className="text-sm text-muted-foreground">{row.employeeName}</p>
                <p className="pt-1 text-sm text-muted-foreground">{row.message}</p>
              </div>
              {row.link ? (
                <Button asChild variant="outline">
                  <a href={row.link} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="size-4" aria-hidden />
                    {t('send')}
                  </a>
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground">{t('noPhone')}</span>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
