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
  StockMovementType,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, getSessionUser, requireRole } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { parseMoneyToCents } from '@/lib/money';
import { computeTotals, type DraftLine } from '@/lib/invoice';
import { expectedCashCents } from '@/lib/cash';
import { allocateNcf, NcfError } from '@/lib/ncf';
import { computeCommission } from '@/lib/commissions';
import { accrual } from '@/lib/loyalty';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type CashState = { ok?: boolean; error?: string; echo?: FormEcho };
export type InvoiceState = {
  ok?: boolean;
  error?: string;
  ncf?: string;
  /// Numéro interne, seul identifiant quand aucun NCF n'est attribué.
  documentNumber?: number;
  invoiceId?: string;
};

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
  productId: z.string().nullable(),
  packageId: z.string().nullable(),
  /// Vente d'un bon cadeau : le bon est créé à l'émission, pour ce montant.
  giftCardSale: z.boolean().default(false),
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

  const lineTotalOf = (line: (typeof parsedLines.data)[number]) =>
    Math.max(0, line.quantity * line.unitPriceCents - line.discountCents);

  // Tout est relu avant la transaction : chaque aller-retour vers une base
  // distante compte contre son délai d'expiration.
  const idsOf = (key: 'employeeId' | 'serviceId' | 'productId' | 'packageId') =>
    [...new Set(parsedLines.data.map((line) => line[key]).filter(Boolean))] as string[];

  const [employees, products] = await Promise.all([
    idsOf('employeeId').length
      ? prisma.employee.findMany({ where: { id: { in: idsOf('employeeId') } } })
      : Promise.resolve([]),
    idsOf('productId').length
      ? prisma.product.findMany({ where: { id: { in: idsOf('productId') } } })
      : Promise.resolve([]),
  ]);

  // Le stock est vérifié avant d'émettre : on ne vend pas ce qu'on n'a pas.
  const soldQty = new Map<string, number>();
  for (const line of parsedLines.data) {
    if (!line.productId) continue;
    soldQty.set(line.productId, (soldQty.get(line.productId) ?? 0) + line.quantity);
  }
  for (const [productId, qty] of soldQty) {
    const product = products.find((entry) => entry.id === productId);
    if (!product || !product.forResale) return { error: 'productNotForResale' };
    if (product.stockQty < qty) return { error: 'outOfStock' };
  }

  // Un règlement par forfait consomme une séance : il faut un forfait valide.
  const packagePayment = parsedPayments.data.find(
    (payment) => payment.method === PaymentMethod.PACKAGE,
  );
  let redeemedPackageId: string | null = null;
  if (packagePayment) {
    if (!input.clientId) return { error: 'packageNeedsClient' };
    const usable = await prisma.clientPackage.findFirst({
      where: { clientId: input.clientId, expiresAt: { gt: new Date() } },
      include: { package: { select: { sessionsTotal: true } } },
      orderBy: { expiresAt: 'asc' },
    });
    if (!usable || usable.sessionsUsed >= usable.package.sessionsTotal) {
      return { error: 'noUsablePackage' };
    }
    redeemedPackageId = usable.id;
  }

  // Commissions : cascade taux du service → taux de l'employée → Paramètres.
  const serviceRates = new Map(
    (await prisma.service.findMany({
      where: { id: { in: idsOf('serviceId') } },
      select: { id: true, commissionRateBp: true },
    })).map((service) => [service.id, service.commissionRateBp]),
  );

  const commissionRows = parsedLines.data
    .map((line) => {
      const employee = employees.find((entry) => entry.id === line.employeeId);
      if (!employee) return null;
      const baseCents = lineTotalOf(line);
      const computed = computeCommission({
        employeeId: employee.id,
        salaryType: employee.salaryType,
        serviceRateBp: line.serviceId ? (serviceRates.get(line.serviceId) ?? null) : null,
        employeeRateBp: employee.commissionRateBp,
        defaultRateBp: settings.defaultCommissionRateBp,
        baseCents,
      });
      return computed ? { ...computed, baseCents } : null;
    })
    .filter(Boolean) as {
    employeeId: string;
    rateBp: number;
    amountCents: number;
    baseCents: number;
  }[];

  // Forfaits vendus : une fiche par ligne, datée depuis la validité du forfait.
  const soldPackages = await prisma.package.findMany({
    where: { id: { in: idsOf('packageId') } },
    select: { id: true, validityDays: true },
  });

  // Bons cadeaux vendus : un code par ligne, crédité du montant encaissé.
  const giftCardSales = parsedLines.data
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.giftCardSale)
    .map(({ line, index }) => ({
      index,
      code: `BC-${Date.now().toString(36).toUpperCase()}-${index}`,
      amountCents: lineTotalOf(line),
      clientId: input.clientId,
    }));

  const loyalty = accrual(totals.subtotalCents, settings.loyaltyPointsPer100Cents);

  const user = await getSessionUser();
  const client = input.clientId
    ? await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } })
    : null;

  // Tant que l'enregistrement DGII n'est pas finalisé, le studio encaisse sans
  // NCF : le document devient un reçu sans valeur fiscale, jamais une facture.
  // Une séquence épuisée ou expirée reste bloquante : le studio est enregistré,
  // il doit demander de nouveaux numéros, pas basculer en reçu en douce.
  const activeSequence = await prisma.ncfSequence.findFirst({
    where: { type: input.ncfType, active: true },
    select: { id: true },
  });

  if (!activeSequence && !settings.allowSalesWithoutNcf) {
    return { error: 'noSequence' };
  }

  // Les bons cadeaux sont validés hors transaction : chaque aller-retour vers une
  // base distante compte contre le délai d'expiration de la transaction.
  const giftCards = new Map<string, { id: string; balanceCents: number }>();
  for (const payment of giftCardPayments) {
    const code = payment.reference.trim().toUpperCase();
    const card = await prisma.giftCard.findUnique({ where: { code } });
    if (!card || !card.active || card.balanceCents < payment.amountCents) {
      return { error: 'giftCardInvalid' };
    }
    giftCards.set(code, { id: card.id, balanceCents: card.balanceCents });
  }

  try {
    const invoice = await prisma.$transaction(
      async (tx) => {
        // Verrou sur la séquence : deux caisses concurrentes ne peuvent pas
        // obtenir le même numéro (§4).
        const allocated = activeSequence ? await allocateNcf(tx, input.ncfType) : null;

        const created = await tx.invoice.create({
          data: {
            clientId: client?.id ?? null,
            appointmentId: input.appointmentId,
            ncf: allocated?.ncf ?? null,
            ncfType: allocated ? input.ncfType : null,
            sequenceId: allocated?.sequenceId ?? null,
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
                productId: line.productId,
                packageId: line.packageId,
                employeeId: line.employeeId,
                quantity: line.quantity,
                unitPriceCents: line.unitPriceCents,
                discountCents: line.discountCents,
                totalCents: Math.max(0, line.quantity * line.unitPriceCents - line.discountCents),
                order: index,
              })),
            },
            payments: {
              create: parsedPayments.data.map((payment) => {
                const code = payment.reference.trim().toUpperCase();
                const card =
                  payment.method === PaymentMethod.GIFT_CARD ? giftCards.get(code) : undefined;
                return {
                  method: payment.method,
                  amountCents: payment.amountCents,
                  reference: payment.reference || null,
                  giftCardId: card?.id ?? null,
                  clientPackageId:
                    payment.method === PaymentMethod.PACKAGE ? redeemedPackageId : null,
                };
              }),
            },
            commissions: { create: commissionRows },
            stockMovements: {
              create: [...soldQty.entries()].map(([productId, qty]) => ({
                productId,
                type: StockMovementType.SALE,
                qty: -qty,
                createdBy: user?.id ?? null,
              })),
            },
            clientPackages: {
              create: parsedLines.data
                .filter((line) => line.packageId && client)
                .flatMap((line) => {
                  const pack = soldPackages.find((entry) => entry.id === line.packageId);
                  if (!pack || !client) return [];
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + pack.validityDays);
                  // Une fiche par exemplaire vendu, chacune avec son compteur.
                  return Array.from({ length: line.quantity }, () => ({
                    clientId: client.id,
                    packageId: pack.id,
                    expiresAt,
                  }));
                }),
            },
          },
        });

        for (const [productId, qty] of soldQty) {
          await tx.product.update({
            where: { id: productId },
            data: { stockQty: { decrement: qty } },
          });
        }

        if (redeemedPackageId) {
          await tx.clientPackage.update({
            where: { id: redeemedPackageId },
            data: { sessionsUsed: { increment: 1 } },
          });
        }

        for (const sale of giftCardSales) {
          const card = await tx.giftCard.create({
            data: {
              code: sale.code,
              clientId: sale.clientId,
              amountCents: sale.amountCents,
              balanceCents: sale.amountCents,
            },
          });
          await tx.invoiceLine.updateMany({
            where: { invoiceId: created.id, order: sale.index },
            data: { giftCardId: card.id },
          });
        }

        // Fidélité : une visite par facture, des points selon le réglage.
        if (client) {
          await tx.loyaltyAccount.upsert({
            where: { clientId: client.id },
            update: {
              points: { increment: loyalty.points },
              visits: { increment: loyalty.visits },
            },
            create: { clientId: client.id, points: loyalty.points, visits: loyalty.visits },
          });
        }

        for (const [, card] of giftCards) {
          const used = parsedPayments.data
            .filter((payment) => payment.method === PaymentMethod.GIFT_CARD)
            .reduce((sum, payment) => sum + payment.amountCents, 0);
          await tx.giftCard.update({
            where: { id: card.id },
            data: { balanceCents: card.balanceCents - used },
          });
        }

        if (input.appointmentId) {
          await tx.appointment.update({
            where: { id: input.appointmentId },
            data: { status: AppointmentStatus.DONE },
          });
        }

        return created;
      },
      // Base distante : le défaut de 5 s ne suffit pas au premier appel à froid.
      { timeout: 20_000, maxWait: 10_000 },
    );

    revalidatePath('/caisse', 'layout');
    return {
      ok: true,
      ncf: invoice.ncf ?? undefined,
      documentNumber: invoice.number,
      invoiceId: invoice.id,
    };
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

  const settings = await getStudioSettings();

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

    // Une séance de forfait consommée est rendue.
    const packagePayments = await tx.payment.findMany({
      where: { invoiceId: id, method: PaymentMethod.PACKAGE, clientPackageId: { not: null } },
    });
    for (const payment of packagePayments) {
      await tx.clientPackage.update({
        where: { id: payment.clientPackageId! },
        data: { sessionsUsed: { decrement: 1 } },
      });
    }

    // Les produits vendus retournent en stock, par un mouvement compensatoire :
    // l'historique conserve la vente et son annulation.
    const sales = await tx.stockMovement.findMany({
      where: { invoiceId: id, type: StockMovementType.SALE },
    });
    for (const sale of sales) {
      await tx.stockMovement.create({
        data: {
          productId: sale.productId,
          type: StockMovementType.ADJUSTMENT,
          qty: -sale.qty,
          reason: trimmed,
          invoiceId: id,
          createdBy: userId,
        },
      });
      await tx.product.update({
        where: { id: sale.productId },
        data: { stockQty: { increment: -sale.qty } },
      });
    }

    // Une facture annulée ne rémunère personne, et le forfait vendu est repris.
    await tx.commission.deleteMany({ where: { invoiceId: id } });
    await tx.clientPackage.deleteMany({ where: { invoiceId: id, sessionsUsed: 0 } });

    // Un bon cadeau vendu sur une facture annulée est désactivé, jamais supprimé :
    // il a pu être remis à la cliente, la trace doit rester.
    const soldCards = await tx.invoiceLine.findMany({
      where: { invoiceId: id, giftCardId: { not: null } },
      select: { giftCardId: true },
    });
    for (const line of soldCards) {
      await tx.giftCard.update({ where: { id: line.giftCardId! }, data: { active: false } });
    }

    // Les points et la visite créditées sont retirés.
    if (invoice.clientId) {
      const account = await tx.loyaltyAccount.findUnique({ where: { clientId: invoice.clientId } });
      if (account) {
        const credited = accrual(invoice.subtotalCents, settings.loyaltyPointsPer100Cents);
        await tx.loyaltyAccount.update({
          where: { clientId: invoice.clientId },
          data: {
            points: Math.max(0, account.points - credited.points),
            visits: Math.max(0, account.visits - credited.visits),
          },
        });
      }
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
  }, { timeout: 20_000, maxWait: 10_000 });

  revalidatePath('/caisse', 'layout');
  return { ok: true };
}
