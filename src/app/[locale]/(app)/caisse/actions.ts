'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  AppointmentStatus,
  CashMovementType,
  InvoiceStatus,
  NcfType,
  PaymentMethod,
  Role,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, getSessionUser, requireRole } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';
import { computeTotals, type DraftLine } from '@/lib/invoice';
import { expectedCashCents } from '@/lib/cash';
import { allocateNcf, NcfError } from '@/lib/ncf';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type CashState = { ok?: boolean; error?: string; echo?: FormEcho };
export type InvoiceState = { ok?: boolean; error?: string; ncf?: string; invoiceId?: string };

const CASH_ROLES = [Role.OWNER, Role.RECEPTION] as const;

async function guard(): Promise<CashState | null> {
  try {
    await requireRole(...CASH_ROLES);
    return null;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }
}

export async function openCashSession(prev: CashState, formData: FormData): Promise<CashState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const open = await prisma.cashSession.findFirst({ where: { closedAt: null } });
  if (open) return { error: 'sessionAlreadyOpen', echo };

  const employeeId = String(formData.get('employeeId') ?? '');
  const openingCents = parseMoneyToCents(String(formData.get('openingCents') ?? '0'));
  if (employeeId === '') return { error: 'employeeRequired', echo };
  if (openingCents === null || openingCents < 0) return { error: 'invalidAmount', echo };

  const user = await getSessionUser();
  await prisma.cashSession.create({
    data: { employeeId, openingCents, openedBy: user?.id ?? null },
  });

  revalidatePath('/caisse', 'layout');
  return { ok: true };
}

export async function addCashMovement(prev: CashState, formData: FormData): Promise<CashState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const session = await prisma.cashSession.findFirst({ where: { closedAt: null } });
  if (!session) return { error: 'noCashSession', echo };

  const amountCents = parseMoneyToCents(String(formData.get('amountCents') ?? ''));
  if (amountCents === null || amountCents <= 0) return { error: 'invalidAmount', echo };

  const reason = String(formData.get('reason') ?? '').trim();
  if (reason === '') return { error: 'required', echo };

  const user = await getSessionUser();
  await prisma.cashMovement.create({
    data: {
      cashSessionId: session.id,
      type: formData.get('type') === 'OUT' ? CashMovementType.OUT : CashMovementType.IN,
      amountCents,
      reason,
      createdBy: user?.id ?? null,
    },
  });

  revalidatePath('/caisse', 'layout');
  return { ok: true };
}

/** Espèces attendues = fond initial + encaissements en espèces + entrées − sorties. */
export async function computeExpectedCents(sessionId: string): Promise<number> {
  const session = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      movements: true,
      invoices: {
        where: { status: InvoiceStatus.ISSUED },
        include: { payments: { where: { method: PaymentMethod.CASH } } },
      },
    },
  });

  const cashIn = session.invoices.reduce(
    (sum, invoice) => sum + invoice.payments.reduce((s, payment) => s + payment.amountCents, 0),
    0,
  );

  return expectedCashCents(session.openingCents, cashIn, session.movements);
}

export async function closeCashSession(prev: CashState, formData: FormData): Promise<CashState> {
  const echo = echoForm(prev.echo, formData);
  const denied = await guard();
  if (denied) return { ...denied, echo };

  const session = await prisma.cashSession.findFirst({ where: { closedAt: null } });
  if (!session) return { error: 'noCashSession', echo };

  const countedCents = parseMoneyToCents(String(formData.get('countedCents') ?? ''));
  if (countedCents === null || countedCents < 0) return { error: 'invalidAmount', echo };

  const expectedCents = await computeExpectedCents(session.id);
  const user = await getSessionUser();

  await prisma.$transaction(async (tx) => {
    await tx.cashSession.update({
      where: { id: session.id },
      data: {
        closedAt: new Date(),
        closedBy: user?.id ?? null,
        countedCents,
        expectedCents,
        differenceCents: countedCents - expectedCents,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user?.id ?? null,
        action: 'CASH_SESSION_CLOSE',
        entity: 'CashSession',
        entityId: session.id,
        after: { countedCents, expectedCents, differenceCents: countedCents - expectedCents },
      },
    });
  });

  revalidatePath('/caisse', 'layout');
  return { ok: true };
}

const lineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  serviceId: z.string().nullable(),
  employeeId: z.string().nullable(),
  quantity: z.number().int().min(1).max(99),
  unitPriceCents: z.number().int().min(0),
  discountCents: z.number().int().min(0),
});

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amountCents: z.number().int().min(1),
  reference: z.string().trim().max(80),
});

export type DraftPayment = z.infer<typeof paymentSchema>;

export async function issueInvoice(input: {
  clientId: string | null;
  appointmentId: string | null;
  ncfType: NcfType;
  lines: DraftLine[];
  payments: DraftPayment[];
}): Promise<InvoiceState> {
  try {
    await requireRole(...CASH_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }

  const session = await prisma.cashSession.findFirst({ where: { closedAt: null } });
  if (!session) return { error: 'noCashSession' };

  const parsedLines = z.array(lineSchema).min(1).safeParse(input.lines);
  if (!parsedLines.success) return { error: 'linesRequired' };

  const parsedPayments = z.array(paymentSchema).safeParse(input.payments);
  if (!parsedPayments.success) return { error: 'invalidAmount' };

  const settings = await getStudioSettings();
  const totals = computeTotals(parsedLines.data, settings.itbisRateBp);

  const paid = parsedPayments.data.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paid < totals.totalCents) return { error: 'paymentMismatch' };

  const giftCardPayments = parsedPayments.data.filter(
    (payment) => payment.method === PaymentMethod.GIFT_CARD,
  );

  const user = await getSessionUser();
  const client = input.clientId
    ? await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } })
    : null;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      // Verrou sur la séquence : deux caisses concurrentes ne peuvent pas
      // obtenir le même numéro (§4).
      const { ncf, sequenceId } = await allocateNcf(tx, input.ncfType);

      const giftCards = new Map<string, { id: string; balanceCents: number }>();
      for (const payment of giftCardPayments) {
        const code = payment.reference.trim().toUpperCase();
        const card = await tx.giftCard.findUnique({ where: { code } });
        if (!card || !card.active || card.balanceCents < payment.amountCents) {
          throw new Error('giftCardInvalid');
        }
        giftCards.set(code, { id: card.id, balanceCents: card.balanceCents });
      }

      const created = await tx.invoice.create({
        data: {
          clientId: client?.id ?? null,
          appointmentId: input.appointmentId,
          ncf,
          ncfType: input.ncfType,
          sequenceId,
          subtotalCents: totals.subtotalCents,
          discountCents: totals.discountCents,
          itbisCents: totals.itbisCents,
          totalCents: totals.totalCents,
          itbisRateBp: settings.itbisRateBp,
          cashSessionId: session.id,
          createdBy: user?.id ?? null,
          locale: settings.defaultLocale,
          lines: {
            create: parsedLines.data.map((line, index) => ({
              description: line.description,
              serviceId: line.serviceId,
              employeeId: line.employeeId,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountCents: line.discountCents,
              totalCents: Math.max(0, line.quantity * line.unitPriceCents - line.discountCents),
              order: index,
            })),
          },
        },
      });

      for (const payment of parsedPayments.data) {
        const code = payment.reference.trim().toUpperCase();
        const card = payment.method === PaymentMethod.GIFT_CARD ? giftCards.get(code) : undefined;

        await tx.payment.create({
          data: {
            invoiceId: created.id,
            method: payment.method,
            amountCents: payment.amountCents,
            reference: payment.reference || null,
            giftCardId: card?.id ?? null,
          },
        });

        if (card) {
          await tx.giftCard.update({
            where: { id: card.id },
            data: { balanceCents: card.balanceCents - payment.amountCents },
          });
        }
      }

      if (input.appointmentId) {
        await tx.appointment.update({
          where: { id: input.appointmentId },
          data: { status: AppointmentStatus.DONE },
        });
      }

      return created;
    });

    revalidatePath('/caisse', 'layout');
    return { ok: true, ncf: invoice.ncf, invoiceId: invoice.id };
  } catch (error) {
    if (error instanceof NcfError) return { error: error.reason };
    if (error instanceof Error && error.message === 'giftCardInvalid') {
      return { error: 'giftCardInvalid' };
    }
    throw error;
  }
}

export async function voidInvoice(id: string, reason: string): Promise<InvoiceState> {
  let userId: string | null = null;
  try {
    const user = await requireRole(Role.OWNER);
    userId = user.id;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }

  const trimmed = reason.trim();
  if (trimmed === '') return { error: 'voidReasonRequired' };

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return { error: 'notFound' };
  if (invoice.status === InvoiceStatus.VOIDED) return { error: 'alreadyVoided' };

  await prisma.$transaction(async (tx) => {
    // Une facture émise n'est jamais modifiée ni supprimée : on l'annule et le
    // NCF est consommé, pas recyclé (§4).
    const after = await tx.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED, voidedAt: new Date(), voidReason: trimmed },
    });

    // Un bon cadeau utilisé sur une facture annulée est recrédité.
    const giftPayments = await tx.payment.findMany({
      where: { invoiceId: id, method: PaymentMethod.GIFT_CARD, giftCardId: { not: null } },
    });
    for (const payment of giftPayments) {
      await tx.giftCard.update({
        where: { id: payment.giftCardId! },
        data: { balanceCents: { increment: payment.amountCents } },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: 'INVOICE_VOID',
        entity: 'Invoice',
        entityId: id,
        before: { status: invoice.status, ncf: invoice.ncf },
        after: { status: after.status, voidReason: trimmed },
      },
    });
  });

  revalidatePath('/caisse', 'layout');
  return { ok: true };
}
