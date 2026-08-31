'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Role, StockMovementType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, getSessionUser, requireRole } from '@/lib/permissions';
import { parseMoneyToCents } from '@/lib/money';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type StockState = { ok?: boolean; error?: string; echo?: FormEcho };

const STOCK_ROLES = [Role.OWNER, Role.RECEPTION] as const;

async function guard(roles: readonly Role[] = STOCK_ROLES): Promise<StockState | null> {
  try {
    await requireRole(...roles);
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }
}

export async function saveSupplier(prev: StockState, formData: FormData): Promise<StockState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      phone: z.string().trim().max(40),
      notes: z.string().trim().max(500),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      phone: formData.get('phone') ?? '',
      notes: formData.get('notes') ?? '',
    });
  if (!parsed.success) return { error: 'nameRequired', echo };

  const id = String(formData.get('id') ?? '');
  if (id === '') await prisma.supplier.create({ data: parsed.data });
  else await prisma.supplier.update({ where: { id }, data: parsed.data });

  revalidatePath('/stock', 'layout');
  return { ok: true };
}

export async function saveProduct(prev: StockState, formData: FormData): Promise<StockState> {
  const echo = echoForm(prev.echo, formData);
  // Les coûts d'achat sont une donnée de marge : réservés à la propriétaire.
  const denied = await guard([Role.OWNER]);
  if (denied) return { ...denied, echo };

  const rawSupplier = String(formData.get('supplierId') ?? '').trim();
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      sku: z.string().trim().max(60),
      costCents: z.number().int().min(0),
      priceCents: z.number().int().min(0),
      minStockQty: z.number().int().min(0).max(100000),
      forResale: z.boolean(),
      active: z.boolean(),
      supplierId: z.string().nullable(),
    })
    .safeParse({
      name: formData.get('name') ?? '',
      sku: formData.get('sku') ?? '',
      costCents: parseMoneyToCents(String(formData.get('costCents') ?? '0')) ?? Number.NaN,
      priceCents: parseMoneyToCents(String(formData.get('priceCents') ?? '0')) ?? Number.NaN,
      minStockQty: Number(String(formData.get('minStockQty') ?? '0')),
      forResale: formData.get('forResale') !== 'off',
      active: formData.get('active') !== 'off',
      supplierId: rawSupplier === '' ? null : rawSupplier,
    });
  if (!parsed.success) return { error: 'generic', echo };

  const id = String(formData.get('id') ?? '');
  if (id === '') {
    // Le stock initial passe par un mouvement : jamais de quantité posée à la main.
    const initial = Number(String(formData.get('stockQty') ?? '0'));
    const product = await prisma.product.create({ data: parsed.data });
    if (Number.isFinite(initial) && initial > 0) {
      const user = await getSessionUser();
      await prisma.$transaction([
        prisma.stockMovement.create({
          data: {
            productId: product.id,
            type: StockMovementType.PURCHASE,
            qty: Math.round(initial),
            reason: 'inventario inicial',
            createdBy: user?.id ?? null,
          },
        }),
        prisma.product.update({
          where: { id: product.id },
          data: { stockQty: Math.round(initial) },
        }),
      ]);
    }
  } else {
    await prisma.product.update({ where: { id }, data: parsed.data });
  }

  revalidatePath('/stock', 'layout');
  return { ok: true };
}

export async function addStockMovement(prev: StockState, formData: FormData): Promise<StockState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const productId = String(formData.get('productId') ?? '');
  const qty = Number(String(formData.get('qty') ?? ''));
  if (productId === '' || !Number.isFinite(qty) || qty === 0) return { error: 'invalidQty', echo };

  const type = String(formData.get('type') ?? '');
  const movementType = (Object.values(StockMovementType) as string[]).includes(type)
    ? (type as StockMovementType)
    : StockMovementType.ADJUSTMENT;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { error: 'notFound', echo };
  if (product.stockQty + Math.round(qty) < 0) return { error: 'outOfStock', echo };

  const user = await getSessionUser();
  await prisma.$transaction([
    prisma.stockMovement.create({
      data: {
        productId,
        type: movementType,
        qty: Math.round(qty),
        reason: String(formData.get('reason') ?? '').trim().slice(0, 200),
        createdBy: user?.id ?? null,
      },
    }),
    prisma.product.update({
      where: { id: productId },
      data: { stockQty: { increment: Math.round(qty) } },
    }),
  ]);

  revalidatePath('/stock', 'layout');
  return { ok: true };
}

export async function deleteProduct(id: string) {
  await requireRole(Role.OWNER);
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  revalidatePath('/stock', 'layout');
}

export async function deleteSupplier(id: string) {
  await requireRole(Role.OWNER);
  await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/stock', 'layout');
}
