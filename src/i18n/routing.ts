import { defineRouting } from 'next-intl/routing';

export const locales = ['es', 'fr'] as const;
export type Locale = (typeof locales)[number];

// L'espagnol est la langue de référence (§3.1).
export const routing = defineRouting({
  locales,
  defaultLocale: 'es',
  localePrefix: 'always',
});
