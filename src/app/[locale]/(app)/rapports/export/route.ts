import { NextResponse, type NextRequest } from 'next/server';
import { AppLocale, Role } from '@prisma/client';
import { getSessionUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
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
  toCsv,
  type Bucket,
} from '@/lib/reports';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const user = await getSessionUser();
  // L'export est une route publique par nature : la garde se fait ici, pas en amont.
  if (!user || user.role === Role.STYLIST) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { locale } = await params;
  const appLocale = (locale === 'fr' ? 'fr' : 'es') as AppLocale;
  const settings = await getStudioSettings();

  const today = todayInStudio(settings.timezone);
  const rawFrom = request.nextUrl.searchParams.get('from');
  const rawTo = request.nextUrl.searchParams.get('to');
  const from = rawFrom && isValidDay(rawFrom) ? rawFrom : `${today.slice(0, 7)}-01`;
  const to = rawTo && isValidDay(rawTo) ? rawTo : today;

  const report = await loadReport(from, to, settings.timezone, appLocale);
  const cents = (value: number) => (value / 100).toFixed(2);

  const section = (title: string, buckets: Bucket[]) =>
    buckets.map((bucket) => [title, bucket.label, bucket.count, cents(bucket.totalCents)]);

  const rows: (string | number)[][] = [
    ['resumen', 'from', '', from],
    ['resumen', 'to', '', to],
    ['resumen', 'revenue', issued(report.invoices).length, cents(revenueCents(report.invoices))],
    ['resumen', 'averageTicket', '', cents(averageTicketCents(report.invoices))],
    ['resumen', 'occupancy', '', formatRate(occupancyRateBp(report.appointments, report.availableMinutes))],
    ['resumen', 'noShow', '', formatRate(noShowRateBp(report.appointments))],
    ...(user.role === Role.OWNER
      ? [['resumen', 'productMargin', '', cents(productMarginCents(report.lines))]]
      : []),
    ...section('day', report.days),
    ...section('service', byService(report.lines)),
    ...section('employee', byEmployee(report.lines, report.employeeNames)),
    ...section('product', byProduct(report.lines)),
  ];

  const csv = toCsv(['section', 'label', 'count', 'total'], rows);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="rapport-${from}_${to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
