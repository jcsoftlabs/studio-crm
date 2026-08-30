import type { AppLocale } from '@prisma/client';

export type ReminderVars = {
  client: string;
  studio: string;
  date: string;
  time: string;
};

/**
 * Les modèles vivent dans les fichiers de messages : le texte part vers la cliente,
 * il doit suivre sa langue, pas celle de l'utilisatrice connectée.
 */
export function fillTemplate(template: string, vars: ReminderVars): string {
  return template.replace(/\{(client|studio|date|time)\}/g, (_, key: keyof ReminderVars) => vars[key]);
}

export const REMINDER_LOCALES: AppLocale[] = ['es', 'fr'];
