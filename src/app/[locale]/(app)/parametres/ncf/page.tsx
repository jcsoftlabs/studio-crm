import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { formatDateOnly } from '@/lib/dates';
import { isLow, remaining } from '@/lib/ncf';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DeactivateSequence, SequenceDialog } from './sequence-dialog';

export default async function NcfPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('ncf');
  const tc = await getTranslations('common');
  const tp = await getTranslations('parametres');
  const appLocale = locale as AppLocale;

  if (user.role !== Role.OWNER) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{tp('ownerOnly')}</CardContent>
        </Card>
      </div>
    );
  }

  const [sequences, settings] = await Promise.all([
    prisma.ncfSequence.findMany({ orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] }),
    getStudioSettings(),
  ]);

  const thresholds = {
    lowThreshold: settings.ncfLowThreshold,
    expiryWarningDays: settings.ncfExpiryWarningDays,
  };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/parametres">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <SequenceDialog />
      </div>

      {sequences.length === 0 ? (
        <Card>
          <CardContent
            className={
              settings.allowSalesWithoutNcf
                ? 'pt-5 text-sm text-muted-foreground'
                : 'pt-5 text-sm text-destructive'
            }
          >
            {settings.allowSalesWithoutNcf ? t('emptyOptional') : t('blocked')}
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {sequences.map((sequence) => {
            const low = sequence.active && isLow(sequence, thresholds);
            return (
              <li key={sequence.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-start gap-3 pt-5">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        {sequence.type.replace('_', '-')} · {sequence.prefix}
                        {!sequence.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
                        {low ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 size-3" aria-hidden />
                            {t('remaining', { count: remaining(sequence) })}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('currentNumber')} : {sequence.currentNumber} / {sequence.maxNumber} ·{' '}
                        {t('remaining', { count: remaining(sequence) })}
                      </p>
                      {sequence.expiresAt ? (
                        <p className="text-sm text-muted-foreground">
                          {t('expiresAt')} {formatDateOnly(sequence.expiresAt, appLocale)}
                        </p>
                      ) : null}
                      {low ? <p className="pt-1 text-sm text-destructive">{t('lowWarning')}</p> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <SequenceDialog sequence={sequence} />
                      {sequence.active ? <DeactivateSequence id={sequence.id} /> : null}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
