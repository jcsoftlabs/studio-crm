import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CategoryControls,
  CategoryDialog,
  DeleteButton,
  PackageDialog,
  ServiceDialog,
} from './catalog-dialogs';

export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('services');
  const tc = await getTranslations('common');

  const appLocale = locale as AppLocale;
  const isOwner = user.role === Role.OWNER;

  const [categories, packages, settings] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      include: {
        services: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
      },
    }),
    prisma.package.findMany({ where: { deletedAt: null }, orderBy: { nameEs: 'asc' } }),
    getStudioSettings(),
  ]);

  const plain = categories.map((c) => ({ id: c.id, nameEs: c.nameEs, nameFr: c.nameFr, active: c.active }));
  const name = (item: { nameEs: string; nameFr: string }) =>
    appLocale === 'es' ? item.nameEs : item.nameFr;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        {isOwner ? <CategoryDialog /> : null}
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {t('categories.empty')}
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                {name(category)}
                {!category.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
              </CardTitle>
              {isOwner ? (
                <div className="flex items-center gap-1">
                  <CategoryDialog category={category} />
                  <CategoryControls id={category.id} />
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {category.services.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('items.empty')}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {category.services.map((service) => (
                    <li key={service.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-medium">
                          {name(service)}
                          {!service.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('duration', { count: service.durationMin })} ·{' '}
                          {formatMoney(service.priceCents, appLocale, settings.currencySymbol)}
                        </p>
                      </div>
                      {isOwner ? (
                        <div className="flex items-center gap-1">
                          <ServiceDialog categories={plain} service={service} />
                          <DeleteButton id={service.id} kind="service" />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {isOwner ? (
                <ServiceDialog categories={plain} categoryId={category.id} />
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>{t('packages.title')}</CardTitle>
          {isOwner ? <PackageDialog /> : null}
        </CardHeader>
        <CardContent>
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('packages.empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {packages.map((pack) => (
                <li key={pack.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {name(pack)}
                      {!pack.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(pack.priceCents, appLocale, settings.currencySymbol)} ·{' '}
                      {t('packages.summary', {
                        sessions: pack.sessionsTotal,
                        days: pack.validityDays,
                      })}
                    </p>
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-1">
                      <PackageDialog pack={pack} />
                      <DeleteButton id={pack.id} kind="package" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
