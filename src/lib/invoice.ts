import { computeItbisCents } from '@/lib/money';

export type DraftLine = {
  description: string;
  serviceId?: string | null;
  employeeId?: string | null;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
};

export type InvoiceTotals = {
  subtotalCents: number;
  discountCents: number;
  itbisCents: number;
  totalCents: number;
};

export function lineTotal(line: DraftLine): number {
  return Math.max(0, line.quantity * line.unitPriceCents - line.discountCents);
}

/**
 * Les prix du catalogue sont hors ITBIS : la taxe s'ajoute au sous-total remisé.
 * Tout reste en centavos entiers, aucun Float nulle part (§3.3).
 */
export function computeTotals(lines: DraftLine[], itbisRateBp: number): InvoiceTotals {
  const gross = lines.reduce((sum, line) => sum + line.quantity * line.unitPriceCents, 0);
  const discountCents = lines.reduce((sum, line) => sum + line.discountCents, 0);
  const subtotalCents = Math.max(0, gross - discountCents);
  const itbisCents = computeItbisCents(subtotalCents, itbisRateBp);
  return { subtotalCents, discountCents, itbisCents, totalCents: subtotalCents + itbisCents };
}

export function paidCents(payments: { amountCents: number }[]): number {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function balanceCents(totals: InvoiceTotals, payments: { amountCents: number }[]): number {
  return totals.totalCents - paidCents(payments);
}
