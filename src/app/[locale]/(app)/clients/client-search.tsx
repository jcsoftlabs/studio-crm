'use client';

import { useEffect, useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';

export function ClientSearch({ defaultValue }: { defaultValue: string }) {
  const t = useTranslations('clients');
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(defaultValue);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (value === defaultValue) return;
    const timer = setTimeout(() => {
      startTransition(() => {
        router.replace(
          value.trim() === ''
            ? { pathname }
            : { pathname, query: { q: value.trim() } },
        );
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, defaultValue, pathname, router]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        inputMode="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchPlaceholder')}
        className="pl-9"
      />
    </div>
  );
}
