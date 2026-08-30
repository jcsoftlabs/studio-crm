'use client';

import { useTranslations } from 'next-intl';
import { MoreHorizontal } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { Role } from '@prisma/client';
import { navFor } from '@/lib/nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function BottomNav({ role }: { role: Role }) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const items = navFor(role);
  const primary = items.filter((i) => i.primary);
  const secondary = items.filter((i) => !i.primary);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
      {primary.map(({ key, href, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {t(`nav.${key}`)}
          </Link>
        );
      })}

      {secondary.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] text-muted-foreground">
            <MoreHorizontal className="size-5" aria-hidden />
            {t('nav.more')}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top">
            {secondary.map(({ key, href, icon: Icon }) => (
              <DropdownMenuItem key={key} asChild>
                <Link href={href}>
                  <Icon className="size-4" aria-hidden />
                  {t(`nav.${key}`)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </nav>
  );
}
