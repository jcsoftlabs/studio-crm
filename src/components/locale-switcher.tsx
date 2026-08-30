'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/routing';
import { Button } from '@/components/ui/button';

/** Bascule autonome, utilisée sur l'écran de connexion (aucun profil à persister). */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const labels: Record<Locale, string> = { es: t('spanish'), fr: t('french') };

  function select(next: Locale) {
    if (next === current) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div role="group" aria-label={t('language')} className="inline-flex rounded-md border border-border p-0.5">
      {locales.map((locale) => (
        <Button
          key={locale}
          type="button"
          size="sm"
          variant={locale === current ? 'default' : 'ghost'}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() => select(locale)}
        >
          {labels[locale]}
        </Button>
      ))}
    </div>
  );
}
