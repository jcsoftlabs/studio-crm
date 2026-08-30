import { describe, expect, it } from 'vitest';
import { balanceCents, computeTotals, lineTotal, paidCents } from '../src/lib/invoice';

const line = (unitPriceCents: number, quantity = 1, discountCents = 0) => ({
  description: 'x',
  quantity,
  unitPriceCents,
  discountCents,
});

describe('totaux de facture', () => {
  it('applique l\'ITBIS 18 % au sous-total', () => {
    const totals = computeTotals([line(100000)], 1800);
    expect(totals).toEqual({
      subtotalCents: 100000,
      discountCents: 0,
      itbisCents: 18000,
      totalCents: 118000,
    });
  });

  it('taxe après la remise, pas avant', () => {
    const totals = computeTotals([line(100000, 1, 20000)], 1800);
    expect(totals.subtotalCents).toBe(80000);
    expect(totals.itbisCents).toBe(14400);
    expect(totals.totalCents).toBe(94400);
  });

  it('additionne plusieurs lignes et quantités', () => {
    const totals = computeTotals([line(80000), line(150000, 2)], 1800);
    expect(totals.subtotalCents).toBe(380000);
    expect(totals.totalCents).toBe(448400);
  });

  it('reste en entiers sur un montant qui ne tombe pas juste', () => {
    const totals = computeTotals([line(12345)], 1800);
    expect(Number.isInteger(totals.itbisCents)).toBe(true);
    expect(totals.itbisCents).toBe(2222);
  });

  it('ne descend jamais sous zéro', () => {
    expect(lineTotal(line(1000, 1, 5000))).toBe(0);
    expect(computeTotals([line(1000, 1, 5000)], 1800).subtotalCents).toBe(0);
  });
});

describe('règlements', () => {
  const totals = computeTotals([line(100000)], 1800);

  it('additionne les moyens de paiement', () => {
    expect(paidCents([{ amountCents: 50000 }, { amountCents: 68000 }])).toBe(118000);
  });

  it('calcule le reste à payer', () => {
    expect(balanceCents(totals, [{ amountCents: 50000 }])).toBe(68000);
    expect(balanceCents(totals, [{ amountCents: 118000 }])).toBe(0);
  });
});
