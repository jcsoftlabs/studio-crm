import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireUser } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { NewClientForm } from './new-client-form';

export default async function NewClientPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations('clients');
  const tc = await getTranslations('common');

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/clients">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">{t('new')}</h1>
        <p className="text-sm text-muted-foreground">{t('newSubtitle')}</p>
      </div>

      <Card>
        <CardContent className="pt-5">
          <NewClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
