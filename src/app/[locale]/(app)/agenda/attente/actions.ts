'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { localToUtc } from '@/lib/agenda';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type WaitlistState = { ok?: boolean; error?: string; echo?: FormEcho };

const ALL_ROLES = [Role.OWNER, Role.RECEPTION, Role.STYLIST] as const;

export async function addWaitlistEntry(
  prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const echo = echoForm(prev.echo, formData);

  try {
    await requireRole(...ALL_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const clientId = String(formData.get('clientId') ?? '');
  if (clientId === '') return { error: 'clientRequired', echo };

  const from = String(formData.get('preferredFrom') ?? '');
  const to = String(formData.get('preferredTo') ?? '');
  const preferredFrom = /^\d{4}-\d{2}-\d{2}$/.test(from) ? localToUtc(from, 0) : null;
  const preferredTo = /^\d{4}-\d{2}-\d{2}$/.test(to) ? localToUtc(to, 24 * 60) : null;
  if (preferredFrom && preferredTo && preferredTo <= preferredFrom) {
    return { error: 'endBeforeStart', echo };
  }

  const serviceId = String(formData.get('serviceId') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '');

  await prisma.waitlistEntry.create({
    data: {
      clientId,
      serviceId: serviceId === '' ? null : serviceId,
      employeeId: employeeId === '' ? null : employeeId,
      note: String(formData.get('note') ?? '').trim().slice(0, 500),
      preferredFrom,
      preferredTo,
    },
  });

  revalidatePath('/agenda/attente', 'layout');
  return { ok: true };
}

export async function resolveWaitlistEntry(id: string) {
  await requireRole(...ALL_ROLES);
  await prisma.waitlistEntry.update({ where: { id }, data: { resolvedAt: new Date() } });
  revalidatePath('/agenda/attente', 'layout');
}
