import { formatInTimeZone } from 'date-fns-tz';
import { enUS, es, fr } from 'date-fns/locale';
import type { AppLocale } from '@prisma/client';

export const STUDIO_TIMEZONE = 'America/Santo_Domingo';

const DATE_FNS_LOCALE = { es, fr, en: enUS } as const;

export function formatInStudioTz(
  date: Date,
  pattern: string,
  locale: AppLocale,
  timeZone: string = STUDIO_TIMEZONE,
) {
  return formatInTimeZone(date, timeZone, pattern, { locale: DATE_FNS_LOCALE[locale] });
}

export function minutesToHHmm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
