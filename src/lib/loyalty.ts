/**
 * Fidélité : une visite par facture émise, et des points proportionnels au montant
 * hors ITBIS. `pointsPer100Cents` à zéro désactive le programme sans rien casser.
 */
export function pointsEarned(subtotalCents: number, pointsPer100Cents: number): number {
  if (pointsPer100Cents <= 0 || subtotalCents <= 0) return 0;
  return Math.floor((subtotalCents / 100) * pointsPer100Cents);
}

export type LoyaltyDelta = { points: number; visits: number };

export function accrual(subtotalCents: number, pointsPer100Cents: number): LoyaltyDelta {
  return { points: pointsEarned(subtotalCents, pointsPer100Cents), visits: 1 };
}

/** Annulation : on retire exactement ce qui avait été crédité, sans passer sous zéro. */
export function reversal(current: LoyaltyDelta, credited: LoyaltyDelta): LoyaltyDelta {
  return {
    points: Math.max(0, current.points - credited.points),
    visits: Math.max(0, current.visits - credited.visits),
  };
}
