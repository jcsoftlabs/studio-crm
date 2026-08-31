import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, InvoiceStatus, Role } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatMoney, formatRateBp } from '@/lib/money';
import { formatInStudioTz } from '@/lib/dates';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { fillTemplate } from '@/lib/whatsapp-templates';
import { getTemplate } from '@/lib/messages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShareButton, TicketButton, VoidInvoiceDialog } from './invoice-actions';

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  if (user.role === Role.STYLIST) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lines: { include: { employee: { select: { name: true } } }, orderBy: { order: 'asc' } },
      payments: true,
    },
  });
  if (!invoice) notFound();

  const t = await getTranslations('facture');
  const tf = t;
  const tc = await getTranslations('common');
  const settings = await getStudioSettings();
  const appLocale = locale as AppLocale;
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);

  // La facture part vers la cliente : le texte suit sa langue, pas l'interface.
  const clientLocale = invoice.client?.locale ?? invoice.locale;
  const templateKey = invoice.ncf ? 'facture.shareText' : 'facture.shareTextReceipt';
  const shareText = fillTemplate(await getTemplate(clientLocale, templateKey), {
    client: invoice.client?.firstName ?? '',
    studio: settings.name.trim() || 'el studio',
    ncf: invoice.ncf ?? '',
    number: String(invoice.number),
    total: money(invoice.totalCents),
  });

  const waLink =
    invoice.client && invoice.client.phone.trim() !== ''
      ? buildWhatsAppLink(invoice.client.phone, shareText)
      : null;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/caisse">
            <ArrowLeft className="size-4" aria-hidden />
            {tc('back')}
          </Link>
        </Button>
        <TicketButton href={`/${locale}/ticket/${invoice.id}`} label={tf('ticketPreview')} />
        {waLink ? <ShareButton link={waLink} /> : null}
        {user.role === Role.OWNER && invoice.status === InvoiceStatus.ISSUED ? (
          <VoidInvoiceDialog id={invoice.id} />
        ) : null}
      </div>

      <Card className="print-ticket">
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="text-center">
            <p className="text-lg font-semibold">{settings.name || 'Studio'}</p>
            {settings.legalName ? <p className="text-sm">{settings.legalName}</p> : null}
            {settings.rnc ? (
              <p className="text-sm">
                {t('rnc')} {settings.rnc}
              </p>
            ) : null}
            {settings.address ? <p className="text-sm">{settings.address}</p> : null}
            {settings.phone ? <p className="text-sm">{settings.phone}</p> : null}
          </div>

          <div className="border-y border-border py-2 text-sm">
            {invoice.ncf ? (
              <p className="font-semibold">
                {t('ncf')} {invoice.ncf}
              </p>
            ) : (
              <>
                <p className="font-semibold">{t('receiptNumber', { number: invoice.number })}</p>
                <p className="pt-1">
                  <Badge variant="destructive">{t('noFiscalValue')}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">{t('noFiscalValueNote')}</p>
              </>
            )}
            <p>
              {t('issuedAt')}{' '}
              {formatInStudioTz(invoice.issuedAt, 'd MMMM yyyy HH:mm', appLocale, settings.timezone)}
            </p>
            <p>{invoice.client ? displayName(invoice.client) : t('noClient')}</p>
            {invoice.status === InvoiceStatus.VOIDED ? (
              <p className="pt-1">
                <Badge variant="destructive">{t('voided')}</Badge>{' '}
                <span className="text-xs">{invoice.voidReason}</span>
              </p>
            ) : null}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1 font-medium">{t('lines')}</th>
                <th className="py-1 text-right font-medium">{tc('quantity')}</th>
                <th className="py-1 text-right font-medium">{tc('total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/50 last:border-0">
                  <td className="py-1">
                    {line.description}
                    {line.employee ? (
                      <span className="block text-xs text-muted-foreground">
                        {t('servedBy')} {line.employee.name}
                      </span>
                    ) : null}
                    {line.discountCents > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {tc('discount')} −{money(line.discountCents)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1 text-right">{line.quantity}</td>
                  <td className="py-1 text-right">{money(line.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
            <Row label={tc('subtotal')} value={money(invoice.subtotalCents)} />
            {invoice.discountCents > 0 ? (
              <Row label={tc('discount')} value={`−${money(invoice.discountCents)}`} />
            ) : null}
            <Row
              label={t('itbis', { rate: formatRateBp(invoice.itbisRateBp, appLocale) })}
              value={money(invoice.itbisCents)}
            />
            <Row label={tc('total')} value={money(invoice.totalCents)} strong />
          </dl>

          <dl className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
            {invoice.payments.map((payment) => (
              <Row
                key={payment.id}
                label={t(`method.${payment.method}` as 'method.CASH')}
                value={money(payment.amountCents)}
              />
            ))}
          </dl>

          <p className="pt-2 text-center text-sm">
            {appLocale === 'es' ? settings.invoiceFooterEs : settings.invoiceFooterFr}
          </p>
          <p className="text-center text-sm">{t('thanks')}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between font-semibold' : 'flex justify-between'}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
