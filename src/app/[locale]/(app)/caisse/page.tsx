import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  AppLocale,
  AppointmentStatus,
  CashMovementType,
  InvoiceStatus,
  Role,
} from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatMoney } from '@/lib/money';
import { formatInStudioTz } from '@/lib/dates';
import { localDayRange, todayInStudio } from '@/lib/agenda';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CloseSessionDialog, MovementDialog, OpenSessionDialog } from './cash-dialogs';
import { SaleDialog, type PendingAppointment } from './sale-dialog';
import { computeExpectedCents } from './actions';

export default async function CaissePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('caisse');
  const tf = await getTranslations('facture');
  const tc = await getTranslations('common');
  const tp = await getTranslations('parametres');
  const appLocale = locale as AppLocale;

  if (user.role === Role.STYLIST) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{tp('ownerOnly')}</CardContent>
        </Card>
      </div>
    );
  }

  const settings = await getStudioSettings();
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);

  const session = await prisma.cashSession.findFirst({
    where: { closedAt: null },
    include: {
      employee: { select: { name: true } },
      movements: { orderBy: { createdAt: 'desc' } },
      invoices: {
        orderBy: { issuedAt: 'desc' },
        include: { client: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  const [employees, clients, services, closedSessions, activeSequences] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.service.findMany({
      where: { deletedAt: null, active: true },
      orderBy: { order: 'asc' },
    }),
    prisma.cashSession.findMany({
      where: { closedAt: { not: null } },
      orderBy: { closedAt: 'desc' },
      take: 5,
      include: { employee: { select: { name: true } } },
    }),
    prisma.ncfSequence.findMany({ where: { active: true }, select: { type: true } }),
  ]);

  const today = todayInStudio(settings.timezone);
  const { start, end } = localDayRange(today, settings.timezone);

  // Rendez-vous terminés ou en cours du jour qui n'ont pas encore de facture.
  const pending = session
    ? await prisma.appointment.findMany({
        where: {
          startAt: { gte: start, lt: end },
          status: { in: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED] },
          invoices: { none: { status: InvoiceStatus.ISSUED } },
        },
        orderBy: { startAt: 'asc' },
        include: {
          client: { select: { id: true, firstName: true, lastName: true } },
          items: { include: { service: true }, orderBy: { order: 'asc' } },
        },
      })
    : [];

  const pendingOptions: PendingAppointment[] = pending.map((appointment) => ({
    id: appointment.id,
    label: `${formatInStudioTz(appointment.startAt, 'HH:mm', appLocale, settings.timezone)} · ${displayName(appointment.client)}`,
    clientId: appointment.clientId,
    lines: appointment.items.map((item) => ({
      description: appLocale === 'es' ? item.service.nameEs : item.service.nameFr,
      serviceId: item.serviceId,
      employeeId: item.employeeId,
      quantity: 1,
      unitPriceCents: item.priceCents,
      discountCents: 0,
    })),
  }));

  const expectedCents = session ? await computeExpectedCents(session.id) : 0;
  const issuedTotal = (session?.invoices ?? [])
    .filter((invoice) => invoice.status === InvoiceStatus.ISSUED)
    .reduce((sum, invoice) => sum + invoice.totalCents, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {session ? (
          <div className="flex flex-wrap gap-2">
            <SaleDialog
              clients={clients.map((client) => ({ id: client.id, name: displayName(client) }))}
              services={services.map((service) => ({
                id: service.id,
                name: appLocale === 'es' ? service.nameEs : service.nameFr,
                priceCents: service.priceCents,
              }))}
              employees={employees}
              appointments={pendingOptions}
              itbisRateBp={settings.itbisRateBp}
              currencySymbol={settings.currencySymbol}
              activeNcfTypes={[...new Set(activeSequences.map((sequence) => sequence.type))]}
            />
            <MovementDialog />
            <CloseSessionDialog
              expectedCents={expectedCents}
              currencySymbol={settings.currencySymbol}
            />
          </div>
        ) : (
          <OpenSessionDialog employees={employees} />
        )}
      </div>

      {!session ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('closed')}</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="grid gap-3 pt-5 sm:grid-cols-4">
              <Stat label={t('openedBy', { name: session.employee.name })} value="" />
              <Stat label={t('openingCents')} value={money(session.openingCents)} />
              <Stat label={t('sales')} value={money(issuedTotal)} />
              <Stat label={t('expectedCents')} value={money(expectedCents)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sales')}</CardTitle>
            </CardHeader>
            <CardContent>
              {session.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noSales')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {session.invoices.map((invoice) => (
                    <li key={invoice.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {invoice.ncf ?? tf('receiptNumber', { number: invoice.number })}
                          {!invoice.ncf ? (
                            <Badge variant="muted">{tf('noFiscalValue')}</Badge>
                          ) : null}
                          {invoice.status === InvoiceStatus.VOIDED ? (
                            <Badge variant="destructive">{tf('voided')}</Badge>
                          ) : null}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {invoice.client ? displayName(invoice.client) : tf('noClient')} ·{' '}
                          {formatInStudioTz(invoice.issuedAt, 'HH:mm', appLocale, settings.timezone)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium">{money(invoice.totalCents)}</span>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/caisse/factures/${invoice.id}`}>{tc('open')}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('movements')}</CardTitle>
            </CardHeader>
            <CardContent>
              {session.movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noMovements')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {session.movements.map((movement) => (
                    <li key={movement.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="flex-1 truncate">{movement.reason}</span>
                      <span
                        className={
                          movement.type === CashMovementType.IN
                            ? 'text-muted-foreground'
                            : 'text-destructive'
                        }
                      >
                        {movement.type === CashMovementType.IN ? '+' : '−'}
                        {money(movement.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {closedSessions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {closedSessions.map((closed) => (
                <li key={closed.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1">
                    {closed.closedAt
                      ? formatInStudioTz(closed.closedAt, 'd MMM HH:mm', appLocale, settings.timezone)
                      : ''}{' '}
                    · {closed.employee.name}
                  </span>
                  <span className="text-muted-foreground">
                    {t('countedCents')} {money(closed.countedCents ?? 0)}
                  </span>
                  <span
                    className={
                      (closed.differenceCents ?? 0) === 0 ? 'text-muted-foreground' : 'text-destructive'
                    }
                  >
                    {t('differenceCents')} {money(closed.differenceCents ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? <p className="text-lg font-semibold">{value}</p> : null}
    </div>
  );
}
