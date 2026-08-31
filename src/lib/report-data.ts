import { AppointmentStatus, InvoiceStatus, type AppLocale } from '@prisma/client';
import { prisma } from '@/lib/db';
import { localToUtc, utcToLocalDay } from '@/lib/agenda';
import type { ReportLine } from '@/lib/reports';

/**
 * Une seule lecture de la base pour tout le rapport : les agrégations sont ensuite
 * faites en mémoire par `src/lib/reports.ts`, qui est testable sans base.
 */
export async function loadReport(from: string, to: string, timeZone: string, locale: AppLocale) {
  const start = localToUtc(from, 0, timeZone);
  const end = localToUtc(to, 24 * 60, timeZone);

  const [invoices, appointments, employees, schedules] = await Promise.all([
    prisma.invoice.findMany({
      where: { issuedAt: { gte: start, lt: end } },
      include: {
        lines: {
          include: {
            service: { select: { nameEs: true, nameFr: true } },
            product: { select: { name: true, costCents: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { startAt: { gte: start, lt: end } },
      select: { status: true, startAt: true, endAt: true },
    }),
    prisma.employee.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    }),
    prisma.employeeSchedule.findMany({
      where: { employee: { deletedAt: null, active: true } },
      select: { weekday: true, closed: true, openMinute: true, closeMinute: true },
    }),
  ]);

  const lines: ReportLine[] = invoices
    .filter((invoice) => invoice.status === InvoiceStatus.ISSUED)
    .flatMap((invoice) =>
      invoice.lines.map((line) => ({
        serviceId: line.serviceId,
        productId: line.productId,
        employeeId: line.employeeId,
        description: line.service
          ? locale === 'es'
            ? line.service.nameEs
            : line.service.nameFr
          : (line.product?.name ?? line.description),
        quantity: line.quantity,
        totalCents: line.totalCents,
        costCents: line.product?.costCents ?? 0,
      })),
    );

  const byDay = new Map<string, { count: number; totalCents: number }>();
  for (const invoice of invoices) {
    if (invoice.status !== InvoiceStatus.ISSUED) continue;
    const day = utcToLocalDay(invoice.issuedAt, timeZone);
    const bucket = byDay.get(day) ?? { count: 0, totalCents: 0 };
    bucket.count += 1;
    bucket.totalCents += invoice.subtotalCents;
    byDay.set(day, bucket);
  }

  // Minutes ouvrables : on additionne les journées travaillées de chaque employée
  // sur la période, d'après leurs horaires hebdomadaires.
  let availableMinutes = 0;
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const day = utcToLocalDay(cursor, timeZone);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    for (const schedule of schedules) {
      if (schedule.weekday !== weekday || schedule.closed) continue;
      availableMinutes += schedule.closeMinute - schedule.openMinute;
    }
  }

  return {
    invoices: invoices.map((invoice) => ({
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      subtotalCents: invoice.subtotalCents,
      totalCents: invoice.totalCents,
    })),
    lines,
    appointments: appointments.map((appointment) => ({
      status: appointment.status as AppointmentStatus,
      minutes: Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000),
    })),
    employeeNames: new Map(employees.map((employee) => [employee.id, employee.name])),
    days: [...byDay.entries()]
      .map(([day, bucket]) => ({ key: day, label: day, ...bucket }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    availableMinutes,
  };
}
