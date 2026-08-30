import { NcfType, type Prisma } from '@prisma/client';

export class NcfError extends Error {
  constructor(public readonly reason: 'noSequence' | 'exhausted' | 'expired') {
    super(reason);
    this.name = 'NcfError';
  }
}

/** `B02` + 8 chiffres : format DGII. Le préfixe est stocké sur la séquence. */
export function formatNcf(prefix: string, number: number): string {
  return `${prefix}${String(number).padStart(8, '0')}`;
}

export function remaining(sequence: { currentNumber: number; maxNumber: number }): number {
  return Math.max(0, sequence.maxNumber - sequence.currentNumber);
}

export function daysUntil(expiresAt: Date | null, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.floor((expiresAt.getTime() - now.getTime()) / 86_400_000);
}

export function isLow(
  sequence: { currentNumber: number; maxNumber: number; expiresAt: Date | null },
  thresholds: { lowThreshold: number; expiryWarningDays: number },
  now = new Date(),
): boolean {
  if (remaining(sequence) < thresholds.lowThreshold) return true;
  const days = daysUntil(sequence.expiresAt, now);
  return days !== null && days < thresholds.expiryWarningDays;
}

type SequenceRow = {
  id: string;
  prefix: string;
  currentNumber: number;
  maxNumber: number;
  expiresAt: Date | null;
};

/**
 * Attribue le prochain NCF. À appeler **uniquement** dans une transaction :
 * `SELECT ... FOR UPDATE` sérialise les caisses concurrentes sur la ligne de séquence.
 * Jamais de count() ni d'incrément côté application (§4).
 */
export async function allocateNcf(
  tx: Prisma.TransactionClient,
  type: NcfType,
  now = new Date(),
): Promise<{ ncf: string; sequenceId: string }> {
  const rows = await tx.$queryRaw<SequenceRow[]>`
    SELECT id, prefix, "currentNumber", "maxNumber", "expiresAt"
    FROM "NcfSequence"
    WHERE type = ${type}::"NcfType" AND active = true
    ORDER BY "createdAt" ASC
    LIMIT 1
    FOR UPDATE
  `;

  const sequence = rows[0];
  if (!sequence) throw new NcfError('noSequence');
  if (sequence.expiresAt && sequence.expiresAt <= now) throw new NcfError('expired');

  const next = sequence.currentNumber + 1;
  if (next > sequence.maxNumber) throw new NcfError('exhausted');

  await tx.ncfSequence.update({
    where: { id: sequence.id },
    data: { currentNumber: next },
  });

  return { ncf: formatNcf(sequence.prefix, next), sequenceId: sequence.id };
}

export const NCF_TYPES = Object.values(NcfType);
