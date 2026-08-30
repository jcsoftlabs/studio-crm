import { CashMovementType } from '@prisma/client';

export type CashMovementLike = { type: CashMovementType; amountCents: number };

/**
 * Espèces attendues en caisse = fond initial + encaissements en espèces
 * + entrées − sorties. Les cartes et virements ne passent pas par le tiroir.
 */
export function expectedCashCents(
  openingCents: number,
  cashPaymentCents: number,
  movements: CashMovementLike[],
): number {
  const net = movements.reduce(
    (sum, movement) =>
      movement.type === CashMovementType.IN ? sum + movement.amountCents : sum - movement.amountCents,
    0,
  );
  return openingCents + cashPaymentCents + net;
}

export function differenceCents(countedCents: number, expectedCents: number): number {
  return countedCents - expectedCents;
}
