import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Role } from '@prisma/client';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('dashboard');
  const settings = await getStudioSettings();
  const needsSetup = settings.name.trim() === '' || settings.rnc.trim() === '';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{settings.name.trim() || t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('welcome', { name: user.name ?? '' })}</p>
      </div>

      {needsSetup && user.role === Role.OWNER ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('setupTitle')}</CardTitle>
            <CardDescription>{t('setupBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/parametres">{t('setupCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5 text-sm text-muted-foreground">{t('emptyState')}</CardContent>
      </Card>
    </div>
  );
}
