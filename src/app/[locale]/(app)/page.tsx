import { AlertTriangle, CalendarDays } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, AppointmentStatus, InvoiceStatus, Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser, scopeToEmployee } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatMoney } from '@/lib/money';
import { formatInStudioTz } from '@/lib/dates';
import { addDaysToDay, localDayRange, todayInStudio } from '@/lib/agenda';
import { isLow } from '@/lib/ncf';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('dashboard');
  const ta = await getTranslations('agenda');
  const appLocale = locale as AppLocale;

  const settings = await getStudioSettings();
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);
  const needsSetup = settings.name.trim() === '' || settings.rnc.trim() === '';

  const scopedEmployeeId = await scopeToEmployee(user);
  const today = todayInStudio(settings.timezone);
  const { start, end } = localDayRange(today, settings.timezone);
  const tomorrow = localDayRange(addDaysToDay(today, 1), settings.timezone);

  const [appointments, invoices, session, lowProducts, sequences, reminders, waitlist] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          startAt: { gte: start, lt: end },
          ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        },
        orderBy: { startAt: 'asc' },
        include: {
          client: { select: { firstName: true, lastName: true } },
          employee: { select: { name: true, color: true } },
        },
      }),
      user.role === Role.STYLIST
        ? Promise.resolve([])
        : prisma.invoice.findMany({
            where: { issuedAt: { gte: start, lt: end }, status: InvoiceStatus.ISSUED },
            select: { subtotalCents: true },
          }),
      user.role === Role.STYLIST
        ? Promise.resolve(null)
        : prisma.cashSession.findFirst({ where: { closedAt: null } }),
      user.role === Role.STYLIST ? Promise.resolve([]) : prisma.product.findMany({
        where: { deletedAt: null, active: true },
        select: { stockQty: true, minStockQty: true },
      }),
      user.role === Role.OWNER
        ? prisma.ncfSequence.findMany({ where: { active: true } })
        : Promise.resolve([]),
      prisma.appointment.count({
        where: {
          startAt: { gte: tomorrow.start, lt: tomorrow.end },
          status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
          ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        },
      }),
      prisma.waitlistEntry.count({ where: { resolvedAt: null } }),
    ]);

  const revenue = invoices.reduce((sum, invoice) => sum + invoice.subtotalCents, 0);
  const pending = appointments.filter(
    (appointment) =>
      appointment.status !== AppointmentStatus.CANCELLED &&
      appointment.status !== AppointmentStatus.NO_SHOW,
  ).length;

  const lowCount = lowProducts.filter((p) => p.stockQty <= p.minStockQty).length;
  const thresholds = {
    lowThreshold: settings.ncfLowThreshold,
    expiryWarningDays: settings.ncfExpiryWarningDays,
  };

  const alerts: string[] = [];
  if (lowCount > 0) alerts.push(t('alertLowStock', { count: lowCount }));
  if (user.role === Role.OWNER && sequences.length === 0) alerts.push(t('alertNoNcf'));
  if (sequences.some((sequence) => isLow(sequence, thresholds))) alerts.push(t('alertNcfLow'));
  if (reminders > 0) alerts.push(t('alertReminders', { count: reminders }));
  if (waitlist > 0) alerts.push(t('alertWaitlist', { count: waitlist }));

  const stats = [
    { label: t('todayAppointments'), value: String(appointments.length) },
    { label: t('pendingToday'), value: String(pending) },
    ...(user.role === Role.STYLIST
      ? []
      : [
          { label: t('todayRevenue'), value: money(revenue) },
          { label: session ? t('cashOpen') : t('cashClosed'), value: session ? money(session.openingCents) : '—' },
        ]),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{settings.name.trim() || t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('welcome', { name: user.name ?? '' })}</p>
      </div>

      {needsSetup && user.role === Role.OWNER ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('setupTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">{t('setupBody')}</p>
            <Button asChild>
              <Link href="/parametres">{t('setupCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold">{stat.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {alerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" aria-hidden />
              {t('alerts')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-1 text-sm">
              {alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{t('todayAppointments')}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/agenda">
              <CalendarDays className="size-4" aria-hidden />
              {t('openAgenda')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noAppointments')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {appointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: appointment.employee.color }}
                  />
                  <span className="w-12 shrink-0 text-muted-foreground">
                    {formatInStudioTz(appointment.startAt, 'HH:mm', appLocale, settings.timezone)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {displayName(appointment.client)}
                  </span>
                  <span className="hidden truncate text-muted-foreground sm:inline">
                    {appointment.employee.name}
                  </span>
                  <Badge variant="muted">
                    {ta(`status.${appointment.status}` as 'status.SCHEDULED')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
