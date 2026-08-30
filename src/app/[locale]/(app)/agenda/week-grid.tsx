'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { minutesToHHmm } from '@/lib/dates';
import type { EmployeeOption } from './appointment-dialog';
import type { GridAppointment } from './day-grid';

type WeekAppointment = GridAppointment & { day: string };

export function WeekGrid({
  days,
  dayLabels,
  appointments,
  employees,
}: {
  days: string[];
  dayLabels: string[];
  appointments: WeekAppointment[];
  employees: EmployeeOption[];
}) {
  const t = useTranslations('agenda');
  const colorOf = new Map(employees.map((employee) => [employee.id, employee.color]));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-max grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dayAppointments = appointments
            .filter((appointment) => appointment.day === day)
            .sort((a, b) => a.startMinute - b.startMinute);

          return (
            <div key={day} className="w-44 rounded-md border border-border">
              <Link
                href={{ pathname: '/agenda', query: { day, view: 'day' } }}
                className="block border-b border-border px-2 py-1.5 text-sm font-medium capitalize hover:bg-muted"
              >
                {dayLabels[index]}
              </Link>
              <ul className="flex flex-col gap-1 p-2">
                {dayAppointments.length === 0 ? (
                  <li className="text-xs text-muted-foreground">{t('empty')}</li>
                ) : (
                  dayAppointments.map((appointment) => (
                    <li
                      key={appointment.id}
                      className="rounded border px-1.5 py-1 text-xs"
                      style={{
                        backgroundColor: `${colorOf.get(appointment.employeeId)}33`,
                        borderColor: colorOf.get(appointment.employeeId),
                      }}
                    >
                      <p className="truncate font-medium">
                        {minutesToHHmm(appointment.startMinute)} {appointment.clientName}
                      </p>
                      <p className="truncate text-muted-foreground">
                        {appointment.serviceNames.join(', ')}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
