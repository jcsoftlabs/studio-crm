import { describe, expect, it } from 'vitest';
import { SalaryType } from '@prisma/client';
import { computeCommission, resolveRateBp, totalCommissions } from '../src/lib/commissions';

const base = {
  employeeId: 'emp-1',
  salaryType: SalaryType.COMMISSION,
  serviceRateBp: null,
  employeeRateBp: null,
  defaultRateBp: 1000,
  baseCents: 100000,
};

describe('cascade des taux', () => {
  it('le taux du service prime sur tout', () => {
    expect(resolveRateBp({ ...base, serviceRateBp: 3000, employeeRateBp: 2000 })).toBe(3000);
  });

  it("sans taux de service, on prend celui de l'employée", () => {
    expect(resolveRateBp({ ...base, employeeRateBp: 2000 })).toBe(2000);
  });

  it('sans rien, on retombe sur le taux des Paramètres', () => {
    expect(resolveRateBp(base)).toBe(1000);
  });

  it('un taux de service à zéro reste prioritaire', () => {
    expect(resolveRateBp({ ...base, serviceRateBp: 0, employeeRateBp: 2000 })).toBe(0);
  });
});

describe('calcul de commission', () => {
  it('applique le taux à la base hors ITBIS', () => {
    expect(computeCommission({ ...base, serviceRateBp: 2500 })).toEqual({
      employeeId: 'emp-1',
      rateBp: 2500,
      amountCents: 25000,
    });
  });

  it('reste en entiers sur un montant qui ne tombe pas juste', () => {
    const result = computeCommission({ ...base, baseCents: 12345, serviceRateBp: 1800 });
    expect(result?.amountCents).toBe(2222);
    expect(Number.isInteger(result?.amountCents)).toBe(true);
  });

  it('ne verse rien à une employée au fixe', () => {
    expect(computeCommission({ ...base, salaryType: SalaryType.FIXED, serviceRateBp: 2500 })).toBeNull();
  });

  it('ne verse rien en location de fauteuil', () => {
    expect(
      computeCommission({ ...base, salaryType: SalaryType.BOOTH_RENT, serviceRateBp: 2500 }),
    ).toBeNull();
  });

  it('ne verse rien sans employée sur la ligne', () => {
    expect(computeCommission({ ...base, employeeId: null, serviceRateBp: 2500 })).toBeNull();
  });

  it('ne verse rien à taux nul ni sur une base nulle', () => {
    expect(computeCommission({ ...base, serviceRateBp: 0 })).toBeNull();
    expect(computeCommission({ ...base, baseCents: 0, serviceRateBp: 2500 })).toBeNull();
  });

  it('additionne un règlement de période', () => {
    expect(totalCommissions([{ amountCents: 25000 }, { amountCents: 1750 }])).toBe(26750);
  });
});
