/**
 * React 19 réinitialise les champs non contrôlés après une action de formulaire.
 * Sur un retour en erreur, la saisie serait perdue : on la renvoie au client, qui
 * remonte les champs avec ces valeurs (le `nonce` sert de clé de remontage).
 */
export type FormEcho = { nonce: number; values: Record<string, string> };

export function echoForm(previous: FormEcho | undefined, formData: FormData): FormEcho {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  return { nonce: (previous?.nonce ?? 0) + 1, values };
}
