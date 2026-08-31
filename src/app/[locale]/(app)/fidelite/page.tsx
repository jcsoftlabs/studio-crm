import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, InvoiceStatus, Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatMoney } from '@/lib/money';
import { formatDateOnly } from '@/lib/dates';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { fillTemplate } from '@/lib/whatsapp-templates';
import { getTemplate } from '@/lib/messages';
import { selectSegment, type SegmentClient, type SegmentKey } from '@/lib/segments';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignList, type CampaignRow } from './campaign-list';

const SEGMENTS: SegmentKey[] = ['inactive', 'birthdays', 'top'];

export default async function FidelitePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ segment?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('fidelite');
  const tp = await getTranslations('parametres');
  const appLocale = locale as AppLocale;

  if (user.role === Role.STYLIST) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{tp('ownerOnly')}</CardContent>
        </Card>
      </div>
    );
  }

  const settings = await getStudioSettings();
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);

  const { segment: rawSegment } = await searchParams;
  const segment = (SEGMENTS as string[]).includes(rawSegment ?? '')
    ? (rawSegment as SegmentKey)
    : 'inactive';

  const [clients, giftCards] = await Promise.all([
    prisma.client.findMany({
      where: { deletedAt: null },
      include: {
        loyalty: true,
        invoices: {
          where: { status: InvoiceStatus.ISSUED },
          select: { issuedAt: true, subtotalCents: true },
        },
      },
    }),
    prisma.giftCard.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { client: { select: { firstName: true, lastName: true } } },
    }),
  ]);

  const rows: SegmentClient[] = clients.map((client) => ({
    id: client.id,
    firstName: client.firstName,
    lastName: client.lastName,
    phone: client.phone,
    birthDate: client.birthDate,
    lastVisitAt: client.invoices.reduce<Date | null>(
      (latest, invoice) => (latest === null || invoice.issuedAt > latest ? invoice.issuedAt : latest),
      null,
    ),
    spentCents: client.invoices.reduce((sum, invoice) => sum + invoice.subtotalCents, 0),
    visits: client.loyalty?.visits ?? 0,
  }));

  const selected = selectSegment(segment, rows, { inactiveAfterDays: settings.inactiveAfterDays });
  const localeOf = new Map(clients.map((client) => [client.id, client.locale]));

  // Chaque message est rédigé dans la langue de la cliente, pas celle de l'interface.
  const campaignRows: CampaignRow[] = await Promise.all(
    selected.map(async (client) => {
      const clientLocale = localeOf.get(client.id) ?? appLocale;
      const template = await getTemplate(clientLocale, `fidelite.templates.${segment}`);
      const message = fillTemplate(template, {
        client: client.firstName,
        studio: settings.name.trim() || 'el studio',
      });
      return {
        id: client.id,
        name: displayName(client),
        detail:
          segment === 'top'
            ? `${t('spent')} ${money(client.spentCents)}`
            : segment === 'birthdays'
              ? (client.birthDate ? formatDateOnly(client.birthDate, appLocale) : '')
              : t('lastVisit', {
                  date: client.lastVisitAt ? formatDateOnly(client.lastVisitAt, appLocale) : t('never'),
                }),
        phone: client.phone,
        message,
        link: client.phone.trim() === '' ? null : buildWhatsAppLink(client.phone, message),
      };
    }),
  );

  const uiTemplate = fillTemplate(await getTemplate(appLocale, `fidelite.templates.${segment}`), {
    client: '{client}',
    studio: settings.name.trim() || 'el studio',
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SEGMENTS.map((key) => (
          <Button
            key={key}
            asChild
            variant={key === segment ? 'default' : 'outline'}
            size="sm"
          >
            <Link href={{ pathname: '/fidelite', query: { segment: key } }}>
              {t(`segments.${key}` as 'segments.inactive')}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(`segments.${segment}` as 'segments.inactive')}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t(`segmentHint.${segment}` as 'segmentHint.inactive', {
              days: settings.inactiveAfterDays,
            })}{' '}
            · {t('count', { count: campaignRows.length })}
          </p>
        </CardHeader>
        <CardContent>
          {campaignRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <CampaignList rows={campaignRows} template={uiTemplate} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('giftCards')}</CardTitle>
        </CardHeader>
        <CardContent>
          {giftCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noGiftCards')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {giftCards.map((card) => (
                <li key={card.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex-1 font-mono">{card.code}</span>
                  <span className="text-muted-foreground">
                    {card.client ? displayName(card.client) : ''}
                  </span>
                  <span className="font-medium">
                    {t('balance')} {money(card.balanceCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
