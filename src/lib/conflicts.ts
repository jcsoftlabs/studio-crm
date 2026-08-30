import { AppointmentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { localToUtc, utcToLocalDay, utcToLocalMinutes } from '@/lib/agenda';

export type ConflictKind = 'OVERLAP' | 'OUTSIDE_HOURS' | 'TIME_OFF' | 'INACTIVE_EMPLOYEE';

export type Conflict = {
  kind: ConflictKind;
  /** Un conflit bloquant ne peut pas être forcé : deux clientes sur la même employée. */
  blocking: boolean;
  detail?: string;
};

/** Une annulation libère le créneau ; une absence non prévenue l'a bien occupé. */
const BUSY_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.DONE,
  AppointmentStatus.NO_SHOW,
];

export async function findConflicts({
  employeeId,
  startAt,
  endAt,
  ignoreAppointmentId,
  timeZone,
}: {
  employeeId: string;
  startAt: Date;
  endAt: Date;
  ignoreAppointmentId?: string;
  timeZone: string;
}): Promise<Conflict[]> {
  const conflicts: Conflict[] = [];

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { schedules: true },
  });

  if (!employee || employee.deletedAt) {
    return [{ kind: 'INACTIVE_EMPLOYEE', blocking: true }];
  }
  if (!employee.active) {
    conflicts.push({ kind: 'INACTIVE_EMPLOYEE', blocking: false });
  }

  // Chevauchement : intervalles semi-ouverts, deux rendez-vous peuvent se toucher.
  const overlapping = await prisma.appointment.findFirst({
    where: {
      employeeId,
      status: { in: BUSY_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    },
    include: { client: { select: { firstName: true, lastName: true } } },
  });

  if (overlapping) {
    conflicts.push({
      kind: 'OVERLAP',
      blocking: true,
      detail: `${overlapping.client.firstName} ${overlapping.client.lastName}`.trim(),
    });
  }

  const timeOff = await prisma.timeOff.findFirst({
    where: { employeeId, startAt: { lt: endAt }, endAt: { gt: startAt } },
  });
  if (timeOff) {
    conflicts.push({ kind: 'TIME_OFF', blocking: false, detail: timeOff.reason });
  }

  const day = utcToLocalDay(startAt, timeZone);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const schedule = employee.schedules.find((entry) => entry.weekday === weekday);
  const startMinute = utcToLocalMinutes(startAt, timeZone);
  const endMinute = startMinute + Math.round((endAt.getTime() - startAt.getTime()) / 60000);

  const outside =
    isOutsideSchedule(schedule, startMinute, endMinute) ||
    utcToLocalDay(new Date(endAt.getTime() - 1), timeZone) !== day;

  if (outside) {
    conflicts.push({ kind: 'OUTSIDE_HOURS', blocking: false });
  }

  return conflicts;
}

export type DaySchedule = { closed: boolean; openMinute: number; closeMinute: number };

/** Règle pure, testable sans base : le créneau tient-il dans la journée de travail ? */
export function isOutsideSchedule(
  schedule: DaySchedule | undefined,
  startMinute: number,
  endMinute: number,
): boolean {
  if (!schedule || schedule.closed) return true;
  if (startMinute < schedule.openMinute) return true;
  if (endMinute > schedule.closeMinute) return true;
  // Un rendez-vous ne peut pas déborder sur le lendemain.
  return endMinute > 24 * 60;
}

export function hasBlocking(conflicts: Conflict[]): boolean {
  return conflicts.some((conflict) => conflict.blocking);
}

export { localToUtc };
