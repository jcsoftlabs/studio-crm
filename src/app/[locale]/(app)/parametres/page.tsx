import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Role } from '@prisma/client';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { SettingsForm } from './settings-form';

export default async function ParametresPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('parametres');
  const tNcf = await getTranslations('ncf');

  if (user.role !== Role.OWNER) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('ownerOnly')}</CardContent>
        </Card>
      </div>
    );
  }

  const settings = await getStudioSettings();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/parametres/ncf">{tNcf('title')}</Link>
        </Button>
      </div>
      <SettingsForm settings={settings} />
    </div>
  );
}
