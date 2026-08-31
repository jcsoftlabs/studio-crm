export type SegmentClient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: Date | null;
  lastVisitAt: Date | null;
  spentCents: number;
  visits: number;
};

export type SegmentKey = 'inactive' | 'birthdays' | 'top';

/**
 * Clientes sans visite depuis `days` jours. Celles qui ne sont jamais venues n'en
 * font pas partie : ce sont des fiches créées, pas des clientes perdues.
 */
export function inactiveClients(
  clients: SegmentClient[],
  days: number,
  now = new Date(),
): SegmentClient[] {
  const threshold = new Date(now.getTime() - days * 86_400_000);
  return clients
    .filter((client) => client.lastVisitAt !== null && client.lastVisitAt < threshold)
    .sort((a, b) => (a.lastVisitAt?.getTime() ?? 0) - (b.lastVisitAt?.getTime() ?? 0));
}

/** Anniversaires du mois courant, triés par jour — l'année de naissance n'importe pas. */
export function birthdaysThisMonth(
  clients: SegmentClient[],
  now = new Date(),
): SegmentClient[] {
  const month = now.getUTCMonth();
  return clients
    .filter((client) => client.birthDate !== null && client.birthDate.getUTCMonth() === month)
    .sort((a, b) => (a.birthDate?.getUTCDate() ?? 0) - (b.birthDate?.getUTCDate() ?? 0));
}

export function topClients(clients: SegmentClient[], limit = 20): SegmentClient[] {
  return clients
    .filter((client) => client.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents)
    .slice(0, limit);
}

export function selectSegment(
  key: SegmentKey,
  clients: SegmentClient[],
  options: { inactiveAfterDays: number; now?: Date },
): SegmentClient[] {
  const now = options.now ?? new Date();
  if (key === 'inactive') return inactiveClients(clients, options.inactiveAfterDays, now);
  if (key === 'birthdays') return birthdaysThisMonth(clients, now);
  return topClients(clients);
}
