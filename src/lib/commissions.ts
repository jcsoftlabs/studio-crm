import { SalaryType } from '@prisma/client';

export type CommissionInput = {
  employeeId: string | null;
  salaryType: SalaryType;
  /// Taux du service, prioritaire ; null = on descend d'un cran.
  serviceRateBp: number | null;
  employeeRateBp: number | null;
  defaultRateBp: number;
  /// Assiette : total de la ligne, remise déduite, hors ITBIS.
  baseCents: number;
};

export type CommissionResult = { employeeId: string; rateBp: number; amountCents: number };

/**
 * Cascade du §5 : taux du service, sinon taux de l'employée, sinon celui des
 * Paramètres. Seules les employées à la commission en génèrent — un fixe ou une
 * location de fauteuil ne se cumule pas avec un pourcentage.
 */
export function resolveRateBp(input: CommissionInput): number {
  return input.serviceRateBp ?? input.employeeRateBp ?? input.defaultRateBp;
}

export function computeCommission(input: CommissionInput): CommissionResult | null {
  if (!input.employeeId) return null;
  if (input.salaryType !== SalaryType.COMMISSION) return null;
  if (input.baseCents <= 0) return null;

  const rateBp = resolveRateBp(input);
  if (rateBp <= 0) return null;

  return {
    employeeId: input.employeeId,
    rateBp,
    amountCents: Math.round((input.baseCents * rateBp) / 10000),
  };
}

export function totalCommissions(rows: { amountCents: number }[]): number {
  return rows.reduce((sum, row) => sum + row.amountCents, 0);
}
