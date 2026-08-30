import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ImportWizard } from './import-wizard';

export default async function ImportClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('clients.import');
  const tc = await getTranslations('common');
  const tp = await getTranslations('parametres');

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/clients">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {user.role === Role.STYLIST ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{tp('ownerOnly')}</CardContent>
        </Card>
      ) : (
        <ImportWizard />
      )}
    </div>
  );
}
