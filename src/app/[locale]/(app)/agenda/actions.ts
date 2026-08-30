'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AppointmentSource, AppointmentStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, getSessionUser, requireRole, scopeToEmployee } from '@/lib/permissions';
import { localToUtc } from '@/lib/agenda';
import { hhmmToMinutes } from '@/lib/dates';
import { findConflicts, hasBlocking, type Conflict } from '@/lib/conflicts';
import { getStudioSettings } from '@/lib/settings';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type AgendaState = {
  ok?: boolean;
  error?: string;
  conflicts?: Conflict[];
  echo?: FormEcho;
};

const ALL_ROLES = [Role.OWNER, Role.RECEPTION, Role.STYLIST] as const;

const schema = z.object({
  clientId: z.string().min(1),
  employeeId: z.string().min(1),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startMinute: z.number().int().min(0).max(24 * 60 - 1),
  serviceIds: z.array(z.string().min(1)).min(1),
  durationMin: z.number().int().min(5).max(600),
  notes: z.string().trim().max(1000),
  source: z.nativeEnum(AppointmentSource),
});

/** Une styliste ne peut agir que sur ses propres rendez-vous. */
async function assertEmployeeScope(employeeId: string) {
  const user = await requireRole(...ALL_ROLES);
  const scope = await scopeToEmployee(user);
  if (scope !== null && scope !== employeeId) throw new ForbiddenError();
  return user;
}

export async function saveAppointment(prev: AgendaState, formData: FormData): Promise<AgendaState> {
  const echo = echoForm(prev.echo, formData);

  const parsed = schema.safeParse({
    clientId: formData.get('clientId') ?? '',
    employeeId: formData.get('employeeId') ?? '',
    day: formData.get('day') ?? '',
    startMinute: hhmmToMinutes(String(formData.get('startTime') ?? '')) ?? Number.NaN,
    serviceIds: formData.getAll('serviceIds').map(String).filter((value) => value !== ''),
    durationMin: Number(String(formData.get('durationMin') ?? '')),
    notes: formData.get('notes') ?? '',
    source: formData.get('source') ?? AppointmentSource.WALK_IN,
  });

  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message =
      field === 'clientId'
        ? 'clientRequired'
        : field === 'employeeId'
          ? 'employeeRequired'
          : field === 'serviceIds'
            ? 'serviceRequired'
            : field === 'durationMin'
              ? 'invalidDuration'
              : 'generic';
    return { error: message, echo };
  }

  try {
    await assertEmployeeScope(parsed.data.employeeId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const settings = await getStudioSettings();
  const startAt = localToUtc(parsed.data.day, parsed.data.startMinute, settings.timezone);
  const endAt = new Date(startAt.getTime() + parsed.data.durationMin * 60000);

  const id = String(formData.get('id') ?? '');
  const force = formData.get('force') === '1';

  const conflicts = await findConflicts({
    employeeId: parsed.data.employeeId,
    startAt,
    endAt,
    ignoreAppointmentId: id === '' ? undefined : id,
    timeZone: settings.timezone,
  });

  // Chevauchement : refus net. Hors horaires ou congé : avertissement, forçable.
  if (hasBlocking(conflicts) || (conflicts.length > 0 && !force)) {
    return { error: 'conflict', conflicts, echo };
  }

  const services = await prisma.service.findMany({
    where: { id: { in: parsed.data.serviceIds }, deletedAt: null },
    select: { id: true, priceCents: true, durationMin: true },
  });
  if (services.length === 0) return { error: 'serviceRequired', echo };

  const user = await getSessionUser();

  await prisma.$transaction(async (tx) => {
    const appointment =
      id === ''
        ? await tx.appointment.create({
            data: {
              clientId: parsed.data.clientId,
              employeeId: parsed.data.employeeId,
              startAt,
              endAt,
              notes: parsed.data.notes,
              source: parsed.data.source,
              createdBy: user?.id ?? null,
            },
          })
        : await tx.appointment.update({
            where: { id },
            data: {
              clientId: parsed.data.clientId,
              employeeId: parsed.data.employeeId,
              startAt,
              endAt,
              notes: parsed.data.notes,
              source: parsed.data.source,
            },
          });

    if (id !== '') await tx.appointmentItem.deleteMany({ where: { appointmentId: id } });

    await tx.appointmentItem.createMany({
      data: parsed.data.serviceIds.map((serviceId, index) => {
        const service = services.find((entry) => entry.id === serviceId);
        return {
          appointmentId: appointment.id,
          serviceId,
          employeeId: parsed.data.employeeId,
          priceCents: service?.priceCents ?? 0,
          durationMin: service?.durationMin ?? 0,
          order: index,
        };
      }),
    });
  });

  revalidatePath('/agenda', 'layout');
  return { ok: true };
}

/** Glisser-déposer : même contrôle serveur que le formulaire, l'UI ne décide rien. */
export async function moveAppointment(
  id: string,
  day: string,
  startMinute: number,
  employeeId: string,
): Promise<AgendaState> {
  try {
    await assertEmployeeScope(employeeId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: 'notFound' };

  const settings = await getStudioSettings();
  const duration = appointment.endAt.getTime() - appointment.startAt.getTime();
  const startAt = localToUtc(day, startMinute, settings.timezone);
  const endAt = new Date(startAt.getTime() + duration);

  const conflicts = await findConflicts({
    employeeId,
    startAt,
    endAt,
    ignoreAppointmentId: id,
    timeZone: settings.timezone,
  });
  if (conflicts.length > 0) return { error: 'conflict', conflicts };

  await prisma.appointment.update({
    where: { id },
    data: { employeeId, startAt, endAt },
  });
  await prisma.appointmentItem.updateMany({ where: { appointmentId: id }, data: { employeeId } });

  revalidatePath('/agenda', 'layout');
  return { ok: true };
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { employeeId: true },
  });
  if (!appointment) return;
  await assertEmployeeScope(appointment.employeeId);

  await prisma.appointment.update({ where: { id }, data: { status } });
  revalidatePath('/agenda', 'layout');
}

export async function deleteAppointment(id: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { employeeId: true },
  });
  if (!appointment) return;
  await assertEmployeeScope(appointment.employeeId);

  // On n'efface pas un rendez-vous : on l'annule, le créneau redevient libre.
  await prisma.appointment.update({
    where: { id },
    data: { status: AppointmentStatus.CANCELLED },
  });
  revalidatePath('/agenda', 'layout');
}
