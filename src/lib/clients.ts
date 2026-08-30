/** Normalisation partagée entre l'écriture (colonnes dérivées) et la recherche. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function buildSearchName(firstName: string, lastName: string): string {
  return normalizeText(`${firstName} ${lastName}`);
}

export function displayName(client: { firstName: string; lastName: string }): string {
  return `${client.firstName} ${client.lastName}`.trim();
}

/**
 * Une recherche saisie au comptoir mélange nom et numéro. On tranche sur la
 * présence de chiffres plutôt que de demander à l'utilisatrice de choisir.
 */
export function searchTerms(query: string): { name: string; phone: string } {
  const trimmed = query.trim();
  return { name: normalizeText(trimmed), phone: digitsOnly(trimmed) };
}
