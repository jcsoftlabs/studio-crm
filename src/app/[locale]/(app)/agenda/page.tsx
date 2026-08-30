import { Bell, ListPlus } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, AppointmentStatus, Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser, scopeToEmployee } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatInStudioTz } from '@/lib/dates';
import {
  isValidDay,
  localDayRange,
  localToUtc,
  localWeekdayOf,
  todayInStudio,
  utcToLocalMinutes,
  weekDays,
} from '@/lib/agenda';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateNav } from './date-nav';
import { DayGrid, type GridAppointment } from './day-grid';
import { DayList } from './day-list';
import { WeekGrid } from './week-grid';

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('agenda');
  const appLocale = locale as AppLocale;

  const settings = await getStudioSettings();
  const { day: rawDay, view: rawView } = await searchParams;
  const day = rawDay && isValidDay(rawDay) ? rawDay : todayInStudio(settings.timezone);
  const view = rawView === 'week' ? 'week' : 'day';

  const scopedEmployeeId = await scopeToEmployee(user);
  const canEdit = user.role !== Role.STYLIST || scopedEmployeeId !== '__none__';

  const employees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      ...(scopedEmployeeId ? { id: scopedEmployeeId } : {}),
    },
    orderBy: { order: 'asc' },
    include: { schedules: true },
  });

  const days = view === 'week' ? weekDays(day) : [day];
  const rangeStart = localDayRange(days[0], settings.timezone).start;
  const rangeEnd = localDayRange(days[days.length - 1], settings.timezone).end;

  const appointments = await prisma.appointment.findMany({
    where: {
      startAt: { gte: rangeStart, lt: rangeEnd },
      ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
    },
    orderBy: { startAt: 'asc' },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
      items: { include: { service: true }, orderBy: { order: 'asc' } },
    },
  });

  const toGrid = (appointment: (typeof appointments)[number]): GridAppointment => {
    const startMinute = utcToLocalMinutes(appointment.startAt, settings.timezone);
    const durationMin = Math.round(
      (appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000,
    );
    const localDay = formatInStudioTz(appointment.startAt, 'yyyy-MM-dd', appLocale, settings.timezone);
    return {
      id: appointment.id,
      employeeId: appointment.employeeId,
      clientName: displayName(appointment.client),
      serviceNames: appointment.items.map((item) =>
        appLocale === 'es' ? item.service.nameEs : item.service.nameFr,
      ),
      startMinute,
      durationMin,
      status: appointment.status,
      defaults: {
        id: appointment.id,
        clientId: appointment.clientId,
        employeeId: appointment.employeeId,
        day: localDay,
        startTime: `${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`,
        durationMin,
        serviceIds: appointment.items.map((item) => item.serviceId),
        notes: appointment.notes,
        source: appointment.source,
      },
    };
  };

  const [clients, services] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.service.findMany({
      where: { deletedAt: null, active: true },
      orderBy: [{ categoryId: 'asc' }, { order: 'asc' }],
      include: { category: true },
    }),
  ]);

  const clientOptions = clients.map((client) => ({ id: client.id, name: displayName(client) }));
  const serviceOptions = services.map((service) => ({
    id: service.id,
    name: appLocale === 'es' ? service.nameEs : service.nameFr,
    durationMin: service.durationMin,
    categoryName: appLocale === 'es' ? service.category.nameEs : service.category.nameFr,
  }));
  const employeeOptions = employees.map((employee) => ({
    id: employee.id,
    name: employee.name,
    color: employee.color,
  }));

  // La grille couvre les horaires du jour, élargis si un rendez-vous déborde.
  const weekday = localWeekdayOf(day, settings.timezone);
  const openMinutes = employees
    .map((employee) => employee.schedules.find((s) => s.weekday === weekday))
    .filter((schedule) => schedule && !schedule.closed)
    .map((schedule) => schedule!);

  const dayAppointments = appointments
    .filter(
      (appointment) =>
        formatInStudioTz(appointment.startAt, 'yyyy-MM-dd', appLocale, settings.timezone) === day,
    )
    .map(toGrid);

  const studioHours = settings.businessHours.find((h) => h.weekday === weekday);
  let gridStart = Math.min(
    ...[
      ...openMinutes.map((s) => s.openMinute),
      studioHours && !studioHours.closed ? studioHours.openMinute : 9 * 60,
      ...dayAppointments.map((a) => a.startMinute),
    ],
  );
  let gridEnd = Math.max(
    ...[
      ...openMinutes.map((s) => s.closeMinute),
      studioHours && !studioHours.closed ? studioHours.closeMinute : 18 * 60,
      ...dayAppointments.map((a) => a.startMinute + a.durationMin),
    ],
  );
  gridStart = Math.max(0, Math.floor(gridStart / 60) * 60);
  gridEnd = Math.min(24 * 60, Math.ceil(gridEnd / 60) * 60);
  if (gridEnd <= gridStart) gridEnd = gridStart + 60;

  const label =
    view === 'week'
      ? `${formatInStudioTz(localToUtc(days[0], 720, settings.timezone), 'd MMM', appLocale, settings.timezone)} – ${formatInStudioTz(localToUtc(days[6], 720, settings.timezone), 'd MMM yyyy', appLocale, settings.timezone)}`
      : formatInStudioTz(localToUtc(day, 720, settings.timezone), 'EEEE d MMMM yyyy', appLocale, settings.timezone);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/agenda/relances">
              <Bell className="size-4" aria-hidden />
              {t('reminders')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/agenda/attente">
              <ListPlus className="size-4" aria-hidden />
              {t('waitlist')}
            </Link>
          </Button>
        </div>
      </div>

      <DateNav day={day} view={view} label={label} />

      {employees.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {t('noEmployees')}
          </CardContent>
        </Card>
      ) : view === 'week' ? (
        <WeekGrid
          days={days}
          appointments={appointments
            .filter((appointment) => appointment.status !== AppointmentStatus.CANCELLED)
            .map((appointment) => ({
              ...toGrid(appointment),
              day: formatInStudioTz(appointment.startAt, 'yyyy-MM-dd', appLocale, settings.timezone),
            }))}
          employees={employeeOptions}
          dayLabels={days.map((value) =>
            formatInStudioTz(localToUtc(value, 720, settings.timezone), 'EEE d', appLocale, settings.timezone),
          )}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <DayGrid
              day={day}
              employees={employeeOptions}
              appointments={dayAppointments.filter((a) => a.status !== AppointmentStatus.CANCELLED)}
              gridStart={gridStart}
              gridEnd={gridEnd}
              clients={clientOptions}
              services={serviceOptions}
              canEdit={canEdit}
            />
          </div>
          <div className="md:hidden">
            <DayList
              day={day}
              employees={employeeOptions}
              appointments={dayAppointments}
              clients={clientOptions}
              services={serviceOptions}
              canEdit={canEdit}
              defaultMinute={gridStart}
            />
          </div>
        </>
      )}
    </div>
  );
}
