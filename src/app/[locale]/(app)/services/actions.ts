'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { parseMoneyToCents, parseRateToBp } from '@/lib/money';

export type CatalogState = { ok?: boolean; error?: string };

async function guard(): Promise<CatalogState | null> {
  try {
    // Le catalogue porte les prix : sa modification reste à la propriétaire.
    await requireRole(Role.OWNER);
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }
}

const nameSchema = z.string().trim().min(1).max(120);

export async function saveCategory(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get('id') ?? '');
  const parsed = z
    .object({ nameEs: nameSchema, nameFr: nameSchema, active: z.boolean() })
    .safeParse({
      nameEs: formData.get('nameEs') ?? '',
      nameFr: formData.get('nameFr') ?? '',
      active: formData.get('active') !== 'off',
    });
  if (!parsed.success) return { error: 'nameRequired' };

  if (id === '') {
    const last = await prisma.serviceCategory.findFirst({
      where: { deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await prisma.serviceCategory.create({
      data: { ...parsed.data, order: (last?.order ?? -1) + 1 },
    });
  } else {
    await prisma.serviceCategory.update({ where: { id }, data: parsed.data });
  }

  revalidatePath('/services', 'layout');
  return { ok: true };
}

export async function moveCategory(id: string, direction: -1 | 1) {
  await requireRole(Role.OWNER);
  const categories = await prisma.serviceCategory.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
    select: { id: true },
  });
  const index = categories.findIndex((c) => c.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= categories.length) return;

  const reordered = [...categories];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  await prisma.$transaction(
    reordered.map((category, position) =>
      prisma.serviceCategory.update({ where: { id: category.id }, data: { order: position } }),
    ),
  );
  revalidatePath('/services', 'layout');
}

export async function deleteCategory(id: string): Promise<CatalogState> {
  const denied = await guard();
  if (denied) return denied;

  const count = await prisma.service.count({ where: { categoryId: id, deletedAt: null } });
  if (count > 0) return { error: 'hasServices' };

  await prisma.serviceCategory.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/services', 'layout');
  return { ok: true };
}

export async function saveService(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get('id') ?? '');
  const rawCommission = String(formData.get('commissionRate') ?? '').trim();

  const parsed = z
    .object({
      categoryId: z.string().min(1),
      nameEs: nameSchema,
      nameFr: nameSchema,
      durationMin: z.number().int().min(5).max(600),
      priceCents: z.number().int().min(0),
      commissionRateBp: z.number().int().min(0).max(10000).nullable(),
      active: z.boolean(),
    })
    .safeParse({
      categoryId: formData.get('categoryId') ?? '',
      nameEs: formData.get('nameEs') ?? '',
      nameFr: formData.get('nameFr') ?? '',
      durationMin: Number(String(formData.get('durationMin') ?? '')),
      priceCents: parseMoneyToCents(String(formData.get('price') ?? '')) ?? Number.NaN,
      commissionRateBp: rawCommission === '' ? null : parseRateToBp(rawCommission),
      active: formData.get('active') !== 'off',
    });
  if (!parsed.success) return { error: 'generic' };

  if (id === '') {
    const last = await prisma.service.findFirst({
      where: { categoryId: parsed.data.categoryId, deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await prisma.service.create({ data: { ...parsed.data, order: (last?.order ?? -1) + 1 } });
  } else {
    await prisma.service.update({ where: { id }, data: parsed.data });
  }

  revalidatePath('/services', 'layout');
  return { ok: true };
}

export async function deleteService(id: string) {
  await requireRole(Role.OWNER);
  await prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/services', 'layout');
}

export async function savePackage(_prev: CatalogState, formData: FormData): Promise<CatalogState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get('id') ?? '');
  const parsed = z
    .object({
      nameEs: nameSchema,
      nameFr: nameSchema,
      priceCents: z.number().int().min(0),
      sessionsTotal: z.number().int().min(1).max(100),
      validityDays: z.number().int().min(1).max(3650),
      active: z.boolean(),
    })
    .safeParse({
      nameEs: formData.get('nameEs') ?? '',
      nameFr: formData.get('nameFr') ?? '',
      priceCents: parseMoneyToCents(String(formData.get('price') ?? '')) ?? Number.NaN,
      sessionsTotal: Number(String(formData.get('sessionsTotal') ?? '')),
      validityDays: Number(String(formData.get('validityDays') ?? '')),
      active: formData.get('active') !== 'off',
    });
  if (!parsed.success) return { error: 'generic' };

  if (id === '') await prisma.package.create({ data: parsed.data });
  else await prisma.package.update({ where: { id }, data: parsed.data });

  revalidatePath('/services', 'layout');
  return { ok: true };
}

export async function deletePackage(id: string) {
  await requireRole(Role.OWNER);
  await prisma.package.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/services', 'layout');
}
