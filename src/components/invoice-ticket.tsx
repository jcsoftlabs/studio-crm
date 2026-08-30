import type { AppLocale, InvoiceStatus } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { formatMoney, formatRateBp } from '@/lib/money';
import { formatInStudioTz } from '@/lib/dates';
import { displayName } from '@/lib/clients';
import type { StudioSettingsWithHours } from '@/lib/settings';

export type TicketInvoice = {
  ncf: string;
  issuedAt: Date;
  status: InvoiceStatus;
  voidReason: string | null;
  subtotalCents: number;
  discountCents: number;
  itbisCents: number;
  totalCents: number;
  itbisRateBp: number;
  client: { firstName: string; lastName: string } | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    discountCents: number;
    totalCents: number;
    employee: { name: string } | null;
  }[];
  payments: { id: string; method: string; amountCents: number }[];
};

/**
 * Le ticket est rendu aux dimensions réelles du papier (80 mm de large,
 * 72 mm imprimables) : ce que l'écran montre est ce que l'imprimante sort.
 */
export async function InvoiceTicket({
  invoice,
  settings,
  locale,
}: {
  invoice: TicketInvoice;
  settings: StudioSettingsWithHours;
  locale: AppLocale;
}) {
  const t = await getTranslations({ locale, namespace: 'facture' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const money = (cents: number) => formatMoney(cents, locale, settings.currencySymbol);
  const paperMm = settings.printerWidthMm;
  const contentMm = Math.max(40, paperMm - 8);

  return (
    <div
      className="ticket bg-white text-black"
      style={{ width: `${paperMm}mm`, padding: '4mm', fontFamily: 'ui-monospace, monospace' }}
    >
      <div style={{ width: `${contentMm}mm`, fontSize: '9pt', lineHeight: 1.35 }}>
        <div className="text-center">
          <p className="text-[11pt] font-bold uppercase">{settings.name || 'Studio'}</p>
          {settings.legalName ? <p>{settings.legalName}</p> : null}
          {settings.rnc ? (
            <p>
              {t('rnc')} {settings.rnc}
            </p>
          ) : null}
          {settings.address ? <p>{settings.address}</p> : null}
          {settings.phone ? <p>{settings.phone}</p> : null}
        </div>

        <Separator />

        <p className="font-bold">
          {t('ncf')} {invoice.ncf}
        </p>
        <p>
          {t('issuedAt')}{' '}
          {formatInStudioTz(invoice.issuedAt, 'dd/MM/yyyy HH:mm', locale, settings.timezone)}
        </p>
        <p>{invoice.client ? displayName(invoice.client) : t('noClient')}</p>
        {invoice.status === 'VOIDED' ? (
          <p className="font-bold">
            *** {t('voided').toUpperCase()} *** {invoice.voidReason}
          </p>
        ) : null}

        <Separator />

        {invoice.lines.map((line) => (
          <div key={line.id} className="pb-1">
            <p>{line.description}</p>
            {line.employee ? <p className="pl-2">{line.employee.name}</p> : null}
            {line.discountCents > 0 ? (
              <p className="pl-2">
                {tc('discount')} -{money(line.discountCents)}
              </p>
            ) : null}
            <div className="flex justify-between">
              <span>x{line.quantity}</span>
              <span>{money(line.totalCents)}</span>
            </div>
          </div>
        ))}

        <Separator />

        <Row label={tc('subtotal')} value={money(invoice.subtotalCents)} />
        {invoice.discountCents > 0 ? (
          <Row label={tc('discount')} value={`-${money(invoice.discountCents)}`} />
        ) : null}
        <Row
          label={t('itbis', { rate: formatRateBp(invoice.itbisRateBp, locale) })}
          value={money(invoice.itbisCents)}
        />
        <Row label={tc('total').toUpperCase()} value={money(invoice.totalCents)} bold />

        <Separator />

        {invoice.payments.map((payment) => (
          <Row
            key={payment.id}
            label={t(`method.${payment.method}` as 'method.CASH')}
            value={money(payment.amountCents)}
          />
        ))}

        <Separator />

        {(locale === 'es' ? settings.invoiceFooterEs : settings.invoiceFooterFr) ? (
          <p className="text-center">
            {locale === 'es' ? settings.invoiceFooterEs : settings.invoiceFooterFr}
          </p>
        ) : null}
        <p className="pt-1 text-center">{t('thanks')}</p>
      </div>
    </div>
  );
}

function Separator() {
  return <p aria-hidden className="overflow-hidden whitespace-nowrap py-1">{'-'.repeat(64)}</p>;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={bold ? 'flex justify-between font-bold' : 'flex justify-between'}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
