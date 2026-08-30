'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AppointmentStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { minutesToHHmm } from '@/lib/dates';
import { SLOT_MINUTES } from '@/lib/agenda';
import { moveAppointment } from './actions';
import type { Conflict } from '@/lib/conflicts';
import { StatusMenu } from './appointment-actions';
import {
  AppointmentDialog,
  defaultsForSlot,
  type AppointmentDefaults,
  type ClientOption,
  type EmployeeOption,
  type ServiceOption,
} from './appointment-dialog';

const SLOT_PX = 16;

export type GridAppointment = {
  id: string;
  employeeId: string;
  clientName: string;
  serviceNames: string[];
  startMinute: number;
  durationMin: number;
  status: AppointmentStatus;
  defaults: AppointmentDefaults;
};

export function DayGrid({
  day,
  employees,
  appointments,
  gridStart,
  gridEnd,
  clients,
  services,
  canEdit,
}: {
  day: string;
  employees: EmployeeOption[];
  appointments: GridAppointment[];
  gridStart: number;
  gridEnd: number;
  clients: ClientOption[];
  services: ServiceOption[];
  canEdit: boolean;
}) {
  const t = useTranslations('agenda');
  const te = useTranslations('errors');
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveConflicts, setMoveConflicts] = useState<Conflict[]>([]);
  // Un seul dialogue pour toute la grille : les créneaux ne font que fixer ses valeurs.
  const [editing, setEditing] = useState<AppointmentDefaults | null>(null);
  const [, startTransition] = useTransition();

  const slotCount = Math.max(1, Math.ceil((gridEnd - gridStart) / SLOT_MINUTES));
  const height = slotCount * SLOT_PX;

  const hourMarks: number[] = [];
  for (let minute = Math.ceil(gridStart / 60) * 60; minute < gridEnd; minute += 60) {
    hourMarks.push(minute);
  }

  function drop(employeeId: string, minute: number) {
    if (!dragging) return;
    const id = dragging;
    setDragging(null);
    startTransition(async () => {
      const result = await moveAppointment(id, day, minute, employeeId);
      setMoveConflicts(result.conflicts ?? []);
      setError(result.error ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error === 'conflict' ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
          {moveConflicts.map((conflict, index) => (
            <li key={index}>
              {t(`conflicts.${conflict.kind}` as 'conflicts.OVERLAP', { name: conflict.detail ?? '' })}
            </li>
          ))}
        </ul>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {te(error as 'generic')}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('hints.drag')}</p>

      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          <div className="w-14 shrink-0" style={{ paddingTop: 32 }}>
            <div className="relative" style={{ height }}>
              {hourMarks.map((minute) => (
                <span
                  key={minute}
                  className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground"
                  style={{ top: ((minute - gridStart) / SLOT_MINUTES) * SLOT_PX }}
                >
                  {minutesToHHmm(minute)}
                </span>
              ))}
            </div>
          </div>

          {employees.map((employee) => (
            <div key={employee.id} className="w-56 shrink-0 border-l border-border">
              <div
                className="flex h-8 items-center gap-2 border-b border-border px-2 text-sm font-medium"
                style={{ backgroundColor: `${employee.color}22` }}
              >
                <span aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: employee.color }} />
                {employee.name}
              </div>

              <div className="relative" style={{ height }}>
                {Array.from({ length: slotCount }, (_, index) => {
                  const minute = gridStart + index * SLOT_MINUTES;
                  const onHour = minute % 60 === 0;
                  return (
                    <div
                      key={minute}
                      className={cn(
                        'absolute inset-x-0 border-t',
                        onHour ? 'border-border' : 'border-border/30',
                      )}
                      style={{ top: index * SLOT_PX, height: SLOT_PX }}
                      onDragOver={(event) => {
                        if (dragging) event.preventDefault();
                      }}
                      onDrop={() => drop(employee.id, minute)}
                    >
                      {canEdit ? (
                        <button
                          type="button"
                          aria-label={`${employee.name} ${minutesToHHmm(minute)}`}
                          className="size-full"
                          onClick={() => setEditing(defaultsForSlot(day, employee.id, minute))}
                        />
                      ) : null}
                    </div>
                  );
                })}

                {appointments
                  .filter((appointment) => appointment.employeeId === employee.id)
                  .map((appointment) => (
                    <AppointmentBlock
                      key={appointment.id}
                      appointment={appointment}
                      color={employee.color}
                      gridStart={gridStart}
                      canEdit={canEdit}
                      onEdit={() => setEditing(appointment.defaults)}
                      onDragStart={() => setDragging(appointment.id)}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <AppointmentDialog
          key={`${editing.id ?? 'new'}-${editing.employeeId}-${editing.startTime}`}
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

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'opacity-100',
  CONFIRMED: 'opacity-100 ring-2 ring-offset-1',
  IN_PROGRESS: 'opacity-100 ring-2 ring-offset-1',
  DONE: 'opacity-60',
  NO_SHOW: 'opacity-60 line-through',
  CANCELLED: 'opacity-40 line-through',
};

function AppointmentBlock({
  appointment,
  color,
  gridStart,
  canEdit,
  onEdit,
  onDragStart,
  onDragEnd,
}: {
  appointment: GridAppointment;
  color: string;
  gridStart: number;
  canEdit: boolean;
  onEdit: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const t = useTranslations('agenda');
  const top = ((appointment.startMinute - gridStart) / SLOT_MINUTES) * SLOT_PX;
  const height = Math.max(SLOT_PX, (appointment.durationMin / SLOT_MINUTES) * SLOT_PX);

  return (
    <div
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1 text-xs',
        canEdit ? 'cursor-grab active:cursor-grabbing' : '',
        STATUS_STYLES[appointment.status] ?? '',
      )}
      style={{ top, height, backgroundColor: `${color}33`, borderColor: color }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate font-medium">{appointment.clientName}</p>
          <p className="truncate text-muted-foreground">
            {minutesToHHmm(appointment.startMinute)} · {appointment.serviceNames.join(', ')}
          </p>
          <p className="truncate text-muted-foreground">
            {t(`status.${appointment.status}` as 'status.SCHEDULED')}
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center">
            <Button variant="ghost" size="icon" aria-label={t('edit')} onClick={onEdit}>
              <Pencil className="size-4" aria-hidden />
            </Button>
            <StatusMenu id={appointment.id} status={appointment.status} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
