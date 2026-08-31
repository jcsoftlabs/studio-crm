import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { isValidDay, todayInStudio } from '@/lib/agenda';
import { loadReport } from '@/lib/report-data';
import {
  averageTicketCents,
  byEmployee,
  byProduct,
  byService,
  formatRate,
  issued,
  noShowRateBp,
  occupancyRateBp,
  productMarginCents,
  revenueCents,
  type Bucket,
} from '@/lib/reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportControls } from './report-controls';

export default async function RapportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('rapports');
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

  const { from: rawFrom, to: rawTo } = await searchParams;
  const today = todayInStudio(settings.timezone);
  const from = rawFrom && isValidDay(rawFrom) ? rawFrom : `${today.slice(0, 7)}-01`;
  const to = rawTo && isValidDay(rawTo) ? rawTo : today;

  const report = await loadReport(from, to, settings.timezone, appLocale);
  const issuedInvoices = issued(report.invoices);

  const stats = [
    { label: t('revenue'), value: money(revenueCents(report.invoices)) },
    { label: t('invoices'), value: String(issuedInvoices.length) },
    { label: t('averageTicket'), value: money(averageTicketCents(report.invoices)) },
    {
      label: t('occupancy'),
      value: `${formatRate(occupancyRateBp(report.appointments, report.availableMinutes))} %`,
    },
    { label: t('noShow'), value: `${formatRate(noShowRateBp(report.appointments))} %` },
  ];

  if (user.role === Role.OWNER) {
    stats.push({ label: t('productMargin'), value: money(productMarginCents(report.lines)) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('subtitle')} · {from} → {to}
        </p>
      </div>

      <ReportControls from={from} to={to} />

      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-lg font-semibold">{stat.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <BucketTable title={t('byDay')} buckets={report.days} money={money} labelHeader={t('columns.day')} t={t} />
      <BucketTable title={t('byService')} buckets={byService(report.lines)} money={money} labelHeader={t('columns.label')} t={t} />
      <BucketTable
        title={t('byEmployee')}
        buckets={byEmployee(report.lines, report.employeeNames)}
        money={money}
        labelHeader={t('columns.label')}
        t={t}
      />
      <BucketTable title={t('byProduct')} buckets={byProduct(report.lines)} money={money} labelHeader={t('columns.label')} t={t} />
    </div>
  );
}

function BucketTable({
  title,
  buckets,
  money,
  labelHeader,
  t,
}: {
  title: string;
  buckets: Bucket[];
  money: (cents: number) => string;
  labelHeader: string;
  t: Awaited<ReturnType<typeof getTranslations<'rapports'>>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-1.5 font-medium">{labelHeader}</th>
                  <th className="py-1.5 text-right font-medium">{t('columns.count')}</th>
                  <th className="py-1.5 text-right font-medium">{t('columns.total')}</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.key} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5">{bucket.label}</td>
                    <td className="py-1.5 text-right">{bucket.count}</td>
                    <td className="py-1.5 text-right">{money(bucket.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
