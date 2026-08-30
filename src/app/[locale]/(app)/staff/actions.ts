'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { hhmmToMinutes } from '@/lib/dates';
import { localToUtc } from '@/lib/agenda';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type StaffState = { ok?: boolean; error?: string; echo?: FormEcho };

const DEFAULT_HOURS = [
  { weekday: 0, closed: true, openMinute: 540, closeMinute: 1080 },
  { weekday: 1, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 2, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 3, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 4, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 5, closed: false, openMinute: 540, closeMinute: 1140 },
  { weekday: 6, closed: false, openMinute: 540, closeMinute: 1140 },
];

async function guard(): Promise<StaffState | null> {
  try {
    await requireRole(Role.OWNER);
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }
}

export async function saveEmployee(prev: StaffState, formData: FormData): Promise<StaffState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const rawUserId = String(formData.get('userId') ?? '').trim();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(80),
      phone: z.string().trim().max(40),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      active: z.boolean(),
      userId: z.string().nullable(),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      phone: formData.get('phone') ?? '',
      color: formData.get('color') ?? '#c084fc',
      active: formData.get('active') !== 'off',
      userId: rawUserId === '' ? null : rawUserId,
    });
  if (!parsed.success) return { error: 'nameRequired', echo };

  const id = String(formData.get('id') ?? '');

  if (id === '') {
    const last = await prisma.employee.findFirst({
      where: { deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const employee = await prisma.employee.create({
      data: { ...parsed.data, order: (last?.order ?? -1) + 1 },
    });
    await prisma.employeeSchedule.createMany({
      data: DEFAULT_HOURS.map((hours) => ({ employeeId: employee.id, ...hours })),
    });
  } else {
    await prisma.employee.update({ where: { id }, data: parsed.data });
  }

  revalidatePath('/staff', 'layout');
  revalidatePath('/agenda', 'layout');
  return { ok: true };
}

export async function deleteEmployee(id: string) {
  await requireRole(Role.OWNER);
  await prisma.employee.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  revalidatePath('/staff', 'layout');
  revalidatePath('/agenda', 'layout');
}

export async function saveSchedule(prev: StaffState, formData: FormData): Promise<StaffState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const employeeId = String(formData.get('employeeId') ?? '');
  if (employeeId === '') return { error: 'notFound', echo };

  const rows: { weekday: number; closed: boolean; openMinute: number; closeMinute: number }[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const closed = formData.get(`closed-${weekday}`) === 'on';
    const openMinute = hhmmToMinutes(String(formData.get(`open-${weekday}`) ?? ''));
    const closeMinute = hhmmToMinutes(String(formData.get(`close-${weekday}`) ?? ''));
    if (openMinute === null || closeMinute === null) return { error: 'invalidTime', echo };
    if (!closed && closeMinute <= openMinute) return { error: 'closeBeforeOpen', echo };
    rows.push({ weekday, closed, openMinute, closeMinute });
  }

  await prisma.$transaction(
    rows.map((row) =>
      prisma.employeeSchedule.upsert({
        where: { employeeId_weekday: { employeeId, weekday: row.weekday } },
        update: row,
        create: { employeeId, ...row },
      }),
    ),
  );

  revalidatePath('/staff', 'layout');
  revalidatePath('/agenda', 'layout');
  return { ok: true };
}

export async function addTimeOff(prev: StaffState, formData: FormData): Promise<StaffState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const employeeId = String(formData.get('employeeId') ?? '');
  const from = String(formData.get('from') ?? '');
  const to = String(formData.get('to') ?? '');
  if (employeeId === '' || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: 'invalidDate', echo };
  }

  // Congé posé sur des journées entières, en heure du studio.
  const startAt = localToUtc(from, 0);
  const endAt = localToUtc(to, 24 * 60);
  if (endAt <= startAt) return { error: 'endBeforeStart', echo };

  await prisma.timeOff.create({
    data: { employeeId, startAt, endAt, reason: String(formData.get('reason') ?? '').trim() },
  });

  revalidatePath('/staff', 'layout');
  revalidatePath('/agenda', 'layout');
  return { ok: true };
}

export async function deleteTimeOff(id: string) {
  await requireRole(Role.OWNER);
  await prisma.timeOff.delete({ where: { id } });
  revalidatePath('/staff', 'layout');
  revalidatePath('/agenda', 'layout');
}
