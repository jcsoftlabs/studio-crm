import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { formatDateOnly, minutesToHHmm } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EmployeeDialog,
  RemoveButton,
  ScheduleDialog,
  TimeOffDialog,
} from './staff-dialogs';

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('staff');
  const tc = await getTranslations('common');
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

  const [employees, accounts] = await Promise.all([
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
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <EmployeeDialog accounts={accounts} />
      </div>

      {employees.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        employees.map((employee) => (
          <Card key={employee.id}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: employee.color }}
                />
                {employee.name}
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
