import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatDateOnly } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WaitlistDialog, WaitlistRows } from './waitlist-client';

export default async function WaitlistPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations('agenda.waiting');
  const tc = await getTranslations('common');
  const appLocale = locale as AppLocale;
  await getStudioSettings();

  const [entries, clients, services, employees] = await Promise.all([
    prisma.waitlistEntry.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        client: { select: { firstName: true, lastName: true } },
        service: true,
        employee: { select: { name: true } },
      },
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: [{ firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.service.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { order: 'asc' },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const rows = entries.map((entry) => ({
    id: entry.id,
    clientName: displayName(entry.client),
    serviceName: entry.service
      ? appLocale === 'es'
        ? entry.service.nameEs
        : entry.service.nameFr
      : null,
    employeeName: entry.employee?.name ?? null,
    note: entry.note,
    window:
      entry.preferredFrom && entry.preferredTo
        ? `${formatDateOnly(entry.preferredFrom, appLocale)} → ${formatDateOnly(new Date(entry.preferredTo.getTime() - 1), appLocale)}`
        : null,
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/agenda">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <WaitlistDialog
          clients={clients.map((client) => ({ id: client.id, name: displayName(client) }))}
          services={services.map((service) => ({
            id: service.id,
            name: appLocale === 'es' ? service.nameEs : service.nameFr,
          }))}
          employees={employees}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <WaitlistRows rows={rows} />
      )}
    </div>
  );
}
