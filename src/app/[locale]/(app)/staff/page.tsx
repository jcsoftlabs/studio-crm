import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { formatDateOnly, minutesToHHmm } from '@/lib/dates';
import { isValidDay, localToUtc, todayInStudio } from '@/lib/agenda';
import { formatMoney } from '@/lib/money';
import { getStudioSettings } from '@/lib/settings';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EmployeeDialog,
  RemoveButton,
  ScheduleDialog,
  TimeOffDialog,
} from './staff-dialogs';
import { CommissionsPanel, type CommissionRow } from './commissions-panel';

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('staff');
  const tc = await getTranslations('common');
  const tCommissions = await getTranslations('commissions');
  const appLocale = locale as AppLocale;

  if (user.role !== Role.OWNER) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('onlyOwner')}</CardContent>
        </Card>
      </div>
    );
  }

  const { from: rawFrom, to: rawTo } = await searchParams;
  const today = todayInStudio();
  const from = rawFrom && isValidDay(rawFrom) ? rawFrom : `${today.slice(0, 7)}-01`;
  const to = rawTo && isValidDay(rawTo) ? rawTo : today;
  const settings = await getStudioSettings();
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);

  const [employees, accounts, commissions] = await Promise.all([
    prisma.employee.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      include: {
        schedules: { orderBy: { weekday: 'asc' } },
        timeOff: { orderBy: { startAt: 'asc' } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    }),
    prisma.commission.findMany({
      where: {
        paidAt: null,
        createdAt: { gte: localToUtc(from, 0), lt: localToUtc(to, 24 * 60) },
      },
      include: { employee: { select: { id: true, name: true } } },
    }),
  ]);

  const byEmployee = new Map<
    string,
    { employeeId: string; employeeName: string; count: number; baseCents: number; amountCents: number }
  >();
  for (const commission of commissions) {
    const row = byEmployee.get(commission.employeeId) ?? {
      employeeId: commission.employeeId,
      employeeName: commission.employee.name,
      count: 0,
      baseCents: 0,
      amountCents: 0,
    };
    row.count += 1;
    row.baseCents += commission.baseCents;
    row.amountCents += commission.amountCents;
    byEmployee.set(commission.employeeId, row);
  }
  const aggregated = [...byEmployee.values()].sort((a, b) => b.amountCents - a.amountCents);
  const pendingCents = aggregated.reduce((sum, row) => sum + row.amountCents, 0);
  const commissionRows: CommissionRow[] = aggregated.map((row) => ({
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    count: row.count,
    baseLabel: money(row.baseCents),
    amountLabel: money(row.amountCents),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <EmployeeDialog accounts={accounts} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tCommissions('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{tCommissions('subtitle')}</p>
        </CardHeader>
        <CardContent>
          <CommissionsPanel
            from={from}
            to={to}
            rows={commissionRows}
            pendingTotal={money(pendingCents)}
          />
        </CardContent>
      </Card>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        employees.map((employee) => (
          <Card key={employee.id}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: employee.color }}
                />
                {employee.name}
                <Badge variant="muted">
                  {tCommissions(`salaryType.${employee.salaryType}` as 'salaryType.COMMISSION')}
                </Badge>
                {!employee.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
              </CardTitle>
              <div className="flex items-center gap-1">
                <EmployeeDialog employee={employee} accounts={accounts} />
                <ScheduleDialog employeeId={employee.id} schedules={employee.schedules} />
                <TimeOffDialog employeeId={employee.id} />
                <RemoveButton id={employee.id} kind="employee" label={tc('delete')} />
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <h3 className="pb-1.5 text-sm font-medium">{t('schedule.title')}</h3>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {employee.schedules.map((schedule) => (
                    <li key={schedule.weekday}>
                      <span className="font-medium">
                        {tc(`weekdays.${schedule.weekday}` as 'weekdays.0')}
                      </span>{' '}
                      {schedule.closed
                        ? tc('closed')
                        : `${minutesToHHmm(schedule.openMinute)}–${minutesToHHmm(schedule.closeMinute)}`}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="pb-1.5 text-sm font-medium">{t('timeOff.title')}</h3>
                {employee.timeOff.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('timeOff.empty')}</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {employee.timeOff.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>
                          {formatDateOnly(entry.startAt, appLocale)} →{' '}
                          {formatDateOnly(new Date(entry.endAt.getTime() - 1), appLocale)}
                        </span>
                        {entry.reason ? <span>· {entry.reason}</span> : null}
                        <RemoveButton id={entry.id} kind="timeOff" label={t('timeOff.delete')} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
