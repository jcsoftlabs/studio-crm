'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { NcfType, PaymentMethod, type AppLocale } from '@prisma/client';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatMoney, formatRateBp, parseMoneyToCents } from '@/lib/money';
import { computeTotals, type DraftLine } from '@/lib/invoice';
import { issueInvoice } from './actions';

type Option = { id: string; name: string };
type ServiceOption = Option & { priceCents: number };
type ProductOption = Option & { priceCents: number; stockQty: number };
type PackageOption = Option & { priceCents: number };
export type PendingAppointment = {
  id: string;
  label: string;
  clientId: string | null;
  lines: DraftLine[];
};

type PaymentRow = { method: PaymentMethod; amount: string; reference: string };

export function SaleDialog({
  clients,
  services,
  products,
  packages,
  employees,
  appointments,
  itbisRateBp,
  currencySymbol,
  activeNcfTypes,
  preset,
}: {
  clients: Option[];
  services: ServiceOption[];
  products: ProductOption[];
  packages: PackageOption[];
  employees: Option[];
  appointments: PendingAppointment[];
  itbisRateBp: number;
  currencySymbol: string;
  /// Types pour lesquels la DGII a délivré une séquence encore active.
  activeNcfTypes: NcfType[];
  preset?: PendingAppointment;
}) {
  const t = useTranslations('facture');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(preset?.clientId ?? '');
  const [appointmentId, setAppointmentId] = useState(preset?.id ?? '');
  const [ncfType, setNcfType] = useState<NcfType>(NcfType.B02);
  const [lines, setLines] = useState<DraftLine[]>(preset?.lines ?? []);
  const [payments, setPayments] = useState<PaymentRow[]>([
    { method: PaymentMethod.CASH, amount: '', reference: '' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ ncf?: string; number?: number } | null>(null);
  const [pending, startTransition] = useTransition();

  // Sans séquence active, l'encaissement sort en reçu : il faut le dire avant.
  const willBeReceipt = !activeNcfTypes.includes(ncfType);

  const totals = useMemo(() => computeTotals(lines, itbisRateBp), [lines, itbisRateBp]);
  const paid = payments.reduce((sum, row) => sum + (parseMoneyToCents(row.amount) ?? 0), 0);
  const balance = totals.totalCents - paid;
  const money = (cents: number) => formatMoney(cents, locale, currencySymbol);

  function addGiftCard() {
    setLines((prev) => [
      ...prev,
      {
        description: t('giftCardLine'),
        serviceId: null,
        productId: null,
        packageId: null,
        giftCardSale: true,
        employeeId: null,
        quantity: 1,
        unitPriceCents: 0,
        discountCents: 0,
      },
    ]);
  }

  function addLine(
    kind: 'service' | 'product' | 'package',
    id: string,
  ) {
    const source =
      kind === 'service'
        ? services.find((entry) => entry.id === id)
        : kind === 'product'
          ? products.find((entry) => entry.id === id)
          : packages.find((entry) => entry.id === id);
    if (!source) return;

    setLines((prev) => [
      ...prev,
      {
        description: source.name,
        serviceId: kind === 'service' ? id : null,
        productId: kind === 'product' ? id : null,
        packageId: kind === 'package' ? id : null,
        giftCardSale: false,
        employeeId: null,
        quantity: 1,
        unitPriceCents: source.priceCents,
        discountCents: 0,
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await issueInvoice({
        clientId: clientId === '' ? null : clientId,
        appointmentId: appointmentId === '' ? null : appointmentId,
        ncfType,
        lines: lines.map((line) => ({
          ...line,
          serviceId: line.serviceId ?? null,
          productId: line.productId ?? null,
          packageId: line.packageId ?? null,
          giftCardSale: line.giftCardSale ?? false,
          employeeId: line.employeeId ?? null,
        })),
        payments: payments
          .map((row) => ({
            method: row.method,
            amountCents: parseMoneyToCents(row.amount) ?? 0,
            reference: row.reference,
          }))
          .filter((row) => row.amountCents > 0),
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      setIssued({ ncf: result.ncf, number: result.documentNumber });
      if (result.invoiceId) router.push(`/caisse/factures/${result.invoiceId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          {t('new')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')} className="max-w-2xl">
        <DialogTitle>{t('new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          {appointments.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appointmentId">{t('fromAppointment')}</Label>
              <Select
                id="appointmentId"
                value={appointmentId}
                onChange={(event) => {
                  const next = appointments.find((entry) => entry.id === event.target.value);
                  setAppointmentId(event.target.value);
                  if (next) {
                    setLines(next.lines);
                    setClientId(next.clientId ?? '');
                  }
                }}
              >
                <option value="">{t('walkIn')}</option>
                {appointments.map((appointment) => (
                  <option key={appointment.id} value={appointment.id}>
                    {appointment.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clientId">{t('client')}</Label>
              <Select
                id="clientId"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">{t('noClient')}</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ncfType">{t('ncfType')}</Label>
              <Select
                id="ncfType"
                value={ncfType}
                onChange={(event) => setNcfType(event.target.value as NcfType)}
              >
                {Object.values(NcfType).map((value) => (
                  <option key={value} value={value}>
                    {value.replace('_', '-')}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {willBeReceipt ? (
            <p
              role="status"
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
            >
              {t('noSequenceWarning')}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="addService">{t('lines')}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select
                id="addService"
                value=""
                onChange={(event) => {
                  addLine('service', event.target.value);
                  event.target.value = '';
                }}
              >
                <option value="">{t('addLine')}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>

              <Select
                id="addProduct"
                aria-label={t('addProduct')}
                value=""
                onChange={(event) => {
                  addLine('product', event.target.value);
                  event.target.value = '';
                }}
              >
                <option value="">{t('addProduct')}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id} disabled={product.stockQty <= 0}>
                    {product.name} ({product.stockQty})
                  </option>
                ))}
              </Select>

              <Select
                id="addPackage"
                aria-label={t('addPackage')}
                value=""
                onChange={(event) => {
                  addLine('package', event.target.value);
                  event.target.value = '';
                }}
              >
                <option value="">{t('addPackage')}</option>
                {packages.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name}
                  </option>
                ))}
              </Select>
            </div>

            <Button variant="outline" size="sm" className="self-start" onClick={addGiftCard}>
              <Plus className="size-4" aria-hidden />
              {t('addGiftCard')}
            </Button>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">{te('linesRequired')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lines.map((line, index) => (
                  <li key={index} className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
                    <div className="min-w-40 flex-1">
                      <Label htmlFor={`desc-${index}`} className="text-xs">
                        {t('lines')}
                      </Label>
                      <Input
                        id={`desc-${index}`}
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                      />
                    </div>
                    <div className="w-16">
                      <Label htmlFor={`qty-${index}`} className="text-xs">
                        {tc('quantity')}
                      </Label>
                      <Input
                        id={`qty-${index}`}
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, { quantity: Math.max(1, Number(event.target.value) || 1) })
                        }
                      />
                    </div>
                    <div className="w-28">
                      <Label htmlFor={`price-${index}`} className="text-xs">
                        {tc('unitPrice')}
                      </Label>
                      <Input
                        id={`price-${index}`}
                        inputMode="decimal"
                        value={(line.unitPriceCents / 100).toString()}
                        onChange={(event) =>
                          updateLine(index, {
                            unitPriceCents: parseMoneyToCents(event.target.value) ?? 0,
                          })
                        }
                      />
                    </div>
                    <div className="w-28">
                      <Label htmlFor={`disc-${index}`} className="text-xs">
                        {tc('discount')}
                      </Label>
                      <Input
                        id={`disc-${index}`}
                        inputMode="decimal"
                        value={(line.discountCents / 100).toString()}
                        onChange={(event) =>
                          updateLine(index, {
                            discountCents: parseMoneyToCents(event.target.value) ?? 0,
                          })
                        }
                      />
                    </div>
                    <div className="w-36">
                      <Label htmlFor={`emp-${index}`} className="text-xs">
                        {t('servedBy')}
                      </Label>
                      <Select
                        id={`emp-${index}`}
                        value={line.employeeId ?? ''}
                        onChange={(event) =>
                          updateLine(index, { employeeId: event.target.value || null })
                        }
                      >
                        <option value="">—</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={tc('remove')}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="flex flex-col gap-1 rounded-md border border-border p-3 text-sm">
            <div className="flex justify-between">
              <dt>{tc('subtotal')}</dt>
              <dd>{money(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t('itbis', { rate: formatRateBp(itbisRateBp, locale) })}</dt>
              <dd>{money(totals.itbisCents)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>{tc('total')}</dt>
              <dd>{money(totals.totalCents)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-2">
            <Label>{t('payments')}</Label>
            {payments.map((row, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <Select
                    aria-label={t('payments')}
                    value={row.method}
                    onChange={(event) =>
                      setPayments((prev) =>
                        prev.map((entry, i) =>
                          i === index
                            ? { ...entry, method: event.target.value as PaymentMethod }
                            : entry,
                        ),
                      )
                    }
                  >
                    {Object.values(PaymentMethod).map((method) => (
                      <option key={method} value={method}>
                        {t(`method.${method}` as 'method.CASH')}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-32">
                  <Input
                    aria-label={tc('amount')}
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(event) =>
                      setPayments((prev) =>
                        prev.map((entry, i) =>
                          i === index ? { ...entry, amount: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>
                {row.method === PaymentMethod.GIFT_CARD || row.method === PaymentMethod.TRANSFER ? (
                  <div className="w-40">
                    <Input
                      aria-label={t('giftCardCode')}
                      placeholder={t('giftCardCode')}
                      value={row.reference}
                      onChange={(event) =>
                        setPayments((prev) =>
                          prev.map((entry, i) =>
                            i === index ? { ...entry, reference: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                  </div>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={tc('remove')}
                  onClick={() => setPayments((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setPayments((prev) => [
                  ...prev,
                  { method: PaymentMethod.CARD, amount: '', reference: '' },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              {t('addPayment')}
            </Button>

            <p className="text-sm text-muted-foreground">
              {balance > 0
                ? `${t('balance')} : ${money(balance)}`
                : `${t('change')} : ${money(Math.abs(balance))}`}
            </p>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(error as 'generic')}
            </p>
          ) : null}
          {issued ? (
            <p className="text-sm text-muted-foreground">
              {issued.ncf
                ? t('issued', { ncf: issued.ncf })
                : t('issuedReceipt', { number: issued.number ?? 0 })}
            </p>
          ) : null}

          <Button
            size="lg"
            disabled={pending || lines.length === 0 || balance > 0}
            onClick={submit}
          >
            {pending ? tc('saving') : willBeReceipt ? t('issueWithoutNcf') : t('issue')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
