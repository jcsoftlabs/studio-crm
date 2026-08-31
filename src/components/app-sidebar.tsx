'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@prisma/client';
import { navFor } from '@/lib/nav';

export function AppSidebar({ role }: { role: Role }) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const items = navFor(role);

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      <div className="px-5 py-5 text-base font-semibold">{t('appName')}</div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 pb-4">
        {items.map(({ key, href, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              prefetch={false}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
