'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { NcfType, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { parseDateOnly } from '@/lib/dates';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type NcfState = { ok?: boolean; error?: string; echo?: FormEcho };

export async function saveSequence(prev: NcfState, formData: FormData): Promise<NcfState> {
  const echo = echoForm(prev.echo, formData);

  let userId: string;
  try {
    const user = await requireRole(Role.OWNER);
    userId = user.id;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const rawExpires = String(formData.get('expiresAt') ?? '').trim();
  const parsed = z
    .object({
      type: z.nativeEnum(NcfType),
      prefix: z.string().trim().regex(/^[A-Z]\d{2}$/),
      currentNumber: z.number().int().min(0),
      maxNumber: z.number().int().min(1),
      expiresAt: z.date().nullable(),
      active: z.boolean(),
    })
    .refine((value) => value.maxNumber > value.currentNumber, { path: ['maxNumber'] })
    .safeParse({
      type: formData.get('type') ?? NcfType.B02,
      prefix: String(formData.get('prefix') ?? '').trim().toUpperCase(),
      currentNumber: Number(String(formData.get('currentNumber') ?? '0')),
      maxNumber: Number(String(formData.get('maxNumber') ?? '0')),
      expiresAt: rawExpires === '' ? null : parseDateOnly(rawExpires),
      active: formData.get('active') !== 'off',
    });

  if (!parsed.success) return { error: 'generic', echo };

  const id = String(formData.get('id') ?? '');

  await prisma.$transaction(async (tx) => {
    const before = id === '' ? null : await tx.ncfSequence.findUnique({ where: { id } });

    const after =
      id === ''
        ? await tx.ncfSequence.create({ data: parsed.data })
        : await tx.ncfSequence.update({ where: { id }, data: parsed.data });

    // Le réglage des NCF est aussi sensible qu'un prix : il est tracé.
    await tx.auditLog.create({
      data: {
        userId,
        action: id === '' ? 'NCF_SEQUENCE_CREATE' : 'NCF_SEQUENCE_UPDATE',
        entity: 'NcfSequence',
        entityId: after.id,
        before: before ? JSON.parse(JSON.stringify(before)) : undefined,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
  });

  revalidatePath('/parametres/ncf', 'layout');
  return { ok: true };
}

export async function deactivateSequence(id: string) {
  const user = await requireRole(Role.OWNER);
  const sequence = await prisma.ncfSequence.findUnique({ where: { id } });
  if (!sequence) return;

  await prisma.$transaction(async (tx) => {
    await tx.ncfSequence.update({ where: { id }, data: { active: false } });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'NCF_SEQUENCE_DEACTIVATE',
        entity: 'NcfSequence',
        entityId: id,
        before: { active: sequence.active },
        after: { active: false },
      },
    });
  });

  revalidatePath('/parametres/ncf', 'layout');
}
