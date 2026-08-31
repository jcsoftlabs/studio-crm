'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { persistLocale } from '@/app/actions/locale';

/**
 * Le changement de langue force un rechargement complet.
 *
 * Une navigation douce laisserait le cache routeur de Next réutiliser le layout
 * `[locale]` déjà rendu : l'URL et la base changent, mais l'écran reste dans
 * l'ancienne langue. Un rechargement garantit que tous les composants serveur
 * sont refaits avec les bons messages.
 */
export function LocaleMenuItems() {
  const t = useTranslations('common');
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const labels: Record<Locale, string> = { es: t('spanish'), fr: t('french') };

  return (
    <>
      {locales.map((locale) => (
        <DropdownMenuItem
          key={locale}
          disabled={pending}
          onSelect={(event) => {
            event.preventDefault();
            if (locale === current) return;
            startTransition(async () => {
              await persistLocale(locale);
              const search = typeof window === 'undefined' ? '' : window.location.search;
              window.location.assign(`/${locale}${pathname === '/' ? '' : pathname}${search}`);
            });
          }}
        >
          <Check className={locale === current ? 'size-4' : 'size-4 opacity-0'} aria-hidden />
          {labels[locale]}
        </DropdownMenuItem>
      ))}
    </>
  );
}
