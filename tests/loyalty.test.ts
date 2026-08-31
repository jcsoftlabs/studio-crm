import { describe, expect, it } from 'vitest';
import { accrual, pointsEarned, reversal } from '../src/lib/loyalty';

describe('points de fidélité', () => {
  it('crédite proportionnellement au montant hors ITBIS', () => {
    // 1 point par tranche de 100 centavos : RD$ 1 500 → 1500 points.
    expect(pointsEarned(150000, 1)).toBe(1500);
    expect(pointsEarned(150000, 2)).toBe(3000);
  });

  it('arrondit vers le bas, jamais en faveur du studio par erreur', () => {
    expect(pointsEarned(15050, 1)).toBe(150);
  });

  it('ne crédite rien quand le programme est désactivé', () => {
    expect(pointsEarned(150000, 0)).toBe(0);
  });

  it('ne crédite rien sur un montant nul', () => {
    expect(pointsEarned(0, 5)).toBe(0);
  });

  it('compte une visite par facture', () => {
    expect(accrual(150000, 1)).toEqual({ points: 1500, visits: 1 });
    expect(accrual(150000, 0)).toEqual({ points: 0, visits: 1 });
  });
});

describe('annulation', () => {
  it('retire exactement ce qui avait été crédité', () => {
    expect(reversal({ points: 3000, visits: 4 }, { points: 1500, visits: 1 })).toEqual({
      points: 1500,
      visits: 3,
    });
  });

  it('ne descend jamais sous zéro', () => {
    expect(reversal({ points: 100, visits: 0 }, { points: 1500, visits: 1 })).toEqual({
      points: 0,
      visits: 0,
    });
  });
});
