import { describe, expect, it } from 'vitest';
import { CashMovementType } from '@prisma/client';
import { differenceCents, expectedCashCents } from '../src/lib/cash';

const IN = (amountCents: number) => ({ type: CashMovementType.IN, amountCents });
const OUT = (amountCents: number) => ({ type: CashMovementType.OUT, amountCents });

describe('caisse', () => {
  it('additionne le fond et les encaissements en espèces', () => {
    expect(expectedCashCents(200000, 177000, [])).toBe(377000);
  });

  it('ajoute les entrées et retranche les sorties', () => {
    expect(expectedCashCents(200000, 0, [IN(50000), OUT(30000)])).toBe(220000);
  });

  it('ignore les moyens hors tiroir (le montant espèces est passé à part)', () => {
    // Facture réglée moitié carte : seule la part espèces entre ici.
    expect(expectedCashCents(0, 77000, [])).toBe(77000);
  });

  it('peut descendre sous zéro si les sorties dépassent', () => {
    expect(expectedCashCents(10000, 0, [OUT(25000)])).toBe(-15000);
  });

  it('calcule l\'écart de comptage dans les deux sens', () => {
    expect(differenceCents(377000, 377000)).toBe(0);
    expect(differenceCents(376500, 377000)).toBe(-500);
    expect(differenceCents(378000, 377000)).toBe(1000);
  });
});
