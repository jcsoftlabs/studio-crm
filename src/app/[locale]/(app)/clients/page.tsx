import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireUser } from '@/lib/permissions';
import { Card, CardContent } from '@/components/ui/card';

export default async function ClientsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">{t('clients.title')}</h1>
      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">{t('common.empty')}</CardContent>
      </Card>
    </div>
  );
}
