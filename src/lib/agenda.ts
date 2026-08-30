import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { STUDIO_TIMEZONE } from '@/lib/dates';

export const SLOT_MINUTES = 15;

/**
 * `2026-08-30` + 540 min, heure du studio → instant UTC stocké en base.
 * Au-delà de 1440 min on bascule sur le jour suivant : `24:00` n'existe pas.
 */
export function localToUtc(day: string, minutes: number, timeZone = STUDIO_TIMEZONE): Date {
  const dayShift = Math.floor(minutes / (24 * 60));
  const withinDay = minutes - dayShift * 24 * 60;
  const target = dayShift === 0 ? day : addDaysToDay(day, dayShift);
  const hours = Math.floor(withinDay / 60);
  const rest = withinDay % 60;
  const stamp = `${target}T${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}:00`;
  return fromZonedTime(stamp, timeZone);
}

export function utcToLocalDay(date: Date, timeZone = STUDIO_TIMEZONE): string {
  const zoned = toZonedTime(date, timeZone);
  return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, '0')}-${String(zoned.getDate()).padStart(2, '0')}`;
}

export function utcToLocalMinutes(date: Date, timeZone = STUDIO_TIMEZONE): number {
  const zoned = toZonedTime(date, timeZone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export function localDayRange(day: string, timeZone = STUDIO_TIMEZONE) {
  return { start: localToUtc(day, 0, timeZone), end: localToUtc(day, 24 * 60, timeZone) };
}

export function localWeekdayOf(day: string, timeZone = STUDIO_TIMEZONE): number {
  return toZonedTime(localToUtc(day, 12 * 60, timeZone), timeZone).getDay();
}

export function addDaysToDay(day: string, amount: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant `day`, pour la vue semaine. */
export function startOfWeekDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const shift = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - shift);
  return date.toISOString().slice(0, 10);
}

export function weekDays(day: string): string[] {
  const monday = startOfWeekDay(day);
  return Array.from({ length: 7 }, (_, index) => addDaysToDay(monday, index));
}

export function todayInStudio(timeZone = STUDIO_TIMEZONE): string {
  return utcToLocalDay(new Date(), timeZone);
}

export function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function buildSlots(openMinute: number, closeMinute: number, step = SLOT_MINUTES): number[] {
  const slots: number[] = [];
  for (let minute = openMinute; minute < closeMinute; minute += step) slots.push(minute);
  return slots;
}

/** Deux intervalles se chevauchent si chacun commence avant que l'autre finisse. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
