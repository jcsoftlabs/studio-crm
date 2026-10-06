import { setRequestLocale } from 'next-intl/server';
import { requireUser } from '@/lib/permissions';
import { AppSidebar } from '@/components/app-sidebar';
import { BottomNav } from '@/components/bottom-nav';
import { UserMenu } from '@/components/user-menu';
import { OfflineBanner } from '@/components/offline-banner';
import { DeveloperCredit } from '@/components/developer-credit';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);

  return (
    <div className="flex min-h-dvh">
      <div className="print:hidden">
        <AppSidebar role={user.role} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-card px-4 print:hidden">
          <span className="text-sm font-semibold md:hidden">{user.name}</span>
          <span className="hidden text-sm text-muted-foreground md:inline">{user.name}</span>
          <UserMenu name={user.name ?? ''} email={user.email ?? ''} />
        </header>
        <OfflineBanner />
        <main className="flex-1 p-4 pb-4 md:p-6">{children}</main>
        <DeveloperCredit className="px-4 pb-24 pt-2 md:pb-6 print:hidden" />
        <div className="print:hidden">
          <BottomNav role={user.role} />
        </div>
      </div>
    </div>
  );
}
