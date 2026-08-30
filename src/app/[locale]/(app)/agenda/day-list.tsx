'use client';

import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { minutesToHHmm } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { StatusMenu } from './appointment-actions';
import {
  AppointmentDialog,
  defaultsForSlot,
  type AppointmentDefaults,
  type ClientOption,
  type EmployeeOption,
  type ServiceOption,
} from './appointment-dialog';
import type { GridAppointment } from './day-grid';

/** Vue mobile : pas de glisser-déposer au doigt, on replanifie par le formulaire. */
export function DayList({
  day,
  employees,
  appointments,
  clients,
  services,
  canEdit,
  defaultMinute,
}: {
  day: string;
  employees: EmployeeOption[];
  appointments: GridAppointment[];
  clients: ClientOption[];
  services: ServiceOption[];
  canEdit: boolean;
  defaultMinute: number;
}) {
  const t = useTranslations('agenda');
  const [editing, setEditing] = useState<AppointmentDefaults | null>(null);
  const colorOf = new Map(employees.map((employee) => [employee.id, employee.color]));
  const nameOf = new Map(employees.map((employee) => [employee.id, employee.name]));

  const sorted = [...appointments].sort((a, b) => a.startMinute - b.startMinute);

  return (
    <div className="flex flex-col gap-3">
      {canEdit && employees.length > 0 ? (
        <Button
          onClick={() => setEditing(defaultsForSlot(day, employees[0].id, defaultMinute))}
          className="self-start"
        >
          <Plus className="size-4" aria-hidden />
          {t('new')}
        </Button>
      ) : null}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((appointment) => (
            <li key={appointment.id}>
              <Card
                className={cn(
                  appointment.status === 'CANCELLED' || appointment.status === 'NO_SHOW'
                    ? 'opacity-60'
                    : '',
                )}
              >
                <CardContent className="flex items-start gap-3 pt-5">
                  <span
                    aria-hidden
                    className="mt-1 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: colorOf.get(appointment.employeeId) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {minutesToHHmm(appointment.startMinute)} · {appointment.clientName}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {appointment.serviceNames.join(', ')}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {nameOf.get(appointment.employeeId)} ·{' '}
                      {t(`status.${appointment.status}` as 'status.SCHEDULED')}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t('edit')}
                        onClick={() => setEditing(appointment.defaults)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <StatusMenu id={appointment.id} status={appointment.status} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <AppointmentDialog
          key={`${editing.id ?? 'new'}-${editing.startTime}`}
          clients={clients}
          employees={employees}
          services={services}
          defaults={editing}
          trigger="none"
          open
          onOpenChange={(value) => {
            if (!value) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
