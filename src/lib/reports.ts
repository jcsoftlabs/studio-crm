import { AppointmentStatus, InvoiceStatus } from '@prisma/client';

export type ReportInvoice = {
  status: InvoiceStatus;
  issuedAt: Date;
  subtotalCents: number;
  totalCents: number;
};

export type ReportLine = {
  serviceId: string | null;
  productId: string | null;
  employeeId: string | null;
  description: string;
  quantity: number;
  totalCents: number;
  costCents: number;
};

export type Bucket = { key: string; label: string; count: number; totalCents: number };

/** Une facture annulée ne compte dans aucun chiffre d'affaires. */
export function issued(invoices: ReportInvoice[]): ReportInvoice[] {
  return invoices.filter((invoice) => invoice.status === InvoiceStatus.ISSUED);
}

export function revenueCents(invoices: ReportInvoice[]): number {
  return issued(invoices).reduce((sum, invoice) => sum + invoice.subtotalCents, 0);
}

/** Panier moyen : hors ITBIS, la taxe n'appartient pas au studio. */
export function averageTicketCents(invoices: ReportInvoice[]): number {
  const rows = issued(invoices);
  if (rows.length === 0) return 0;
  return Math.round(revenueCents(rows) / rows.length);
}

function group(
  rows: { key: string | null; label: string; quantity: number; totalCents: number }[],
): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    if (row.key === null) continue;
    const bucket = buckets.get(row.key) ?? { key: row.key, label: row.label, count: 0, totalCents: 0 };
    bucket.count += row.quantity;
    bucket.totalCents += row.totalCents;
    buckets.set(row.key, bucket);
  }
  return [...buckets.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export function byService(lines: ReportLine[]): Bucket[] {
  return group(
    lines.map((line) => ({
      key: line.serviceId,
      label: line.description,
      quantity: line.quantity,
      totalCents: line.totalCents,
    })),
  );
}

export function byProduct(lines: ReportLine[]): Bucket[] {
  return group(
    lines.map((line) => ({
      key: line.productId,
      label: line.description,
      quantity: line.quantity,
      totalCents: line.totalCents,
    })),
  );
}

export function byEmployee(lines: ReportLine[], names: Map<string, string>): Bucket[] {
  return group(
    lines.map((line) => ({
      key: line.employeeId,
      label: line.employeeId ? (names.get(line.employeeId) ?? '') : '',
      quantity: line.quantity,
      totalCents: line.totalCents,
    })),
  );
}

/** Marge produits : prix de vente encaissé moins le coût d'achat, réservé à OWNER. */
export function productMarginCents(lines: ReportLine[]): number {
  return lines
    .filter((line) => line.productId)
    .reduce((sum, line) => sum + (line.totalCents - line.costCents * line.quantity), 0);
}

export type ReportAppointment = { status: AppointmentStatus; minutes: number };

/** Une annulation n'est pas une absence : elle sort du dénominateur. */
export function noShowRateBp(appointments: ReportAppointment[]): number {
  const honored = appointments.filter(
    (appointment) => appointment.status !== AppointmentStatus.CANCELLED,
  );
  if (honored.length === 0) return 0;
  const noShows = honored.filter(
    (appointment) => appointment.status === AppointmentStatus.NO_SHOW,
  ).length;
  return Math.round((noShows / honored.length) * 10000);
}

/**
 * Taux d'occupation : minutes réellement réservées sur minutes ouvrables.
 * Les rendez-vous annulés ne consomment pas de temps.
 */
export function occupancyRateBp(
  appointments: ReportAppointment[],
  availableMinutes: number,
): number {
  if (availableMinutes <= 0) return 0;
  const booked = appointments
    .filter((appointment) => appointment.status !== AppointmentStatus.CANCELLED)
    .reduce((sum, appointment) => sum + appointment.minutes, 0);
  return Math.min(10000, Math.round((booked / availableMinutes) * 10000));
}

export function formatRate(bp: number): string {
  return (bp / 100).toFixed(1);
}

/** CSV lu par Excel : point-virgule et BOM, sinon les accents cassent. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))];
  return `\ufeff${lines.join('\r\n')}\r\n`;
}
