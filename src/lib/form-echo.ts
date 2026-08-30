/**
 * React 19 réinitialise les champs non contrôlés après une action de formulaire.
 * Sur un retour en erreur, la saisie serait perdue : on la renvoie au client, qui
 * remonte les champs avec ces valeurs (le `nonce` sert de clé de remontage).
 */
export type FormEcho = { nonce: number; values: Record<string, string | string[]> };

export function echoForm(previous: FormEcho | undefined, formData: FormData): FormEcho {
  const values: Record<string, string | string[]> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;
    const existing = values[key];
    if (existing === undefined) values[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else values[key] = [existing, value];
  }

  return { nonce: (previous?.nonce ?? 0) + 1, values };
}

export function echoString(echo: FormEcho | undefined, key: string, fallback: string): string {
  const value = echo?.values[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value[0] ?? fallback;
  return fallback;
}

/** `null` tant qu'aucun envoi n'a eu lieu ; `[]` si la case a été décochée. */
export function echoArray(echo: FormEcho | undefined, key: string): string[] | null {
  if (!echo) return null;
  const value = echo.values[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
