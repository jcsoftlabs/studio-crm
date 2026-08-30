import type { AppLocale } from '@prisma/client';

const NUMBER_LOCALE: Record<AppLocale, string> = { es: 'es-DO', fr: 'fr-FR' };

export function formatMoney(cents: number, locale: AppLocale, symbol = 'RD$') {
  const value = cents / 100;
  const formatted = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${symbol} ${formatted}`;
}

// Accepte les deux écritures : es-DO "1,250.50" et fr-FR "1 250,50".
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const negative = cleaned.trimStart().startsWith('-');
  const body = cleaned.replace(/-/g, '');
  const sepIndex = Math.max(body.lastIndexOf('.'), body.lastIndexOf(','));

  let intPart = body;
  let fracPart = '';
  if (sepIndex !== -1 && /^\d{1,2}$/.test(body.slice(sepIndex + 1))) {
    intPart = body.slice(0, sepIndex);
    fracPart = body.slice(sepIndex + 1);
  }

  intPart = intPart.replace(/[.,]/g, '');
  if (intPart === '' && fracPart === '') return null;

  const value = Number(`${intPart || '0'}.${(fracPart || '0').padEnd(2, '0')}`);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) * (negative ? -1 : 1);
}

export function formatRateBp(bp: number, locale: AppLocale) {
  return new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(bp / 100);
}

export function parseRateToBp(input: string): number | null {
  const value = Number(input.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/// ITBIS calculé sur des entiers uniquement : rateBp est en points de base (1800 = 18 %).
export function computeItbisCents(subtotalCents: number, rateBp: number) {
  return Math.round((subtotalCents * rateBp) / 10000);
}
