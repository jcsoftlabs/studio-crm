/**
 * Les modèles vivent dans les fichiers de messages : le texte part vers la cliente,
 * il doit suivre sa langue, pas celle de l'utilisatrice connectée.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}
