'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { persistLocale } from '@/app/actions/locale';

/**
 * Radix ferme le menu au clic : on garde le contrôle du select pour attendre
 * l'écriture du profil avant de naviguer, sinon la bascule est perdue.
 */
export function LocaleMenuItems() {
  const t = useTranslations('common');
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const labels: Record<Locale, string> = { es: t('spanish'), fr: t('french') };

  return (
    <>
      {locales.map((locale) => (
        <DropdownMenuItem
          key={locale}
          onSelect={async (event) => {
            event.preventDefault();
            if (locale === current) return;
            await persistLocale(locale);
            router.replace(pathname, { locale });
          }}
        >
          <Check className={locale === current ? 'size-4' : 'size-4 opacity-0'} aria-hidden />
          {labels[locale]}
        </DropdownMenuItem>
      ))}
    </>
  );
}
