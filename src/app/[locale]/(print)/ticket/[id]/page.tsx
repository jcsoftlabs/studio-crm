import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { InvoiceTicket } from '@/components/invoice-ticket';
import { PrintBar } from './print-bar';

export default async function TicketPage({
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

  const settings = await getStudioSettings();
  // Le ticket suit la langue de la cliente, comme le message WhatsApp.
  const ticketLocale = (invoice.client?.locale ?? invoice.locale) as AppLocale;

  return (
    <main className="flex min-h-dvh flex-col items-center bg-muted print:bg-white">
      {/* La largeur du papier vient des Paramètres : @page doit la suivre. */}
      <style>{`@page { size: ${settings.printerWidthMm}mm auto; margin: 0; }`}</style>
      <PrintBar paperWidthMm={settings.printerWidthMm} />
      <div className="mb-8 shadow-lg print:mb-0 print:shadow-none">
        <InvoiceTicket invoice={invoice} settings={settings} locale={ticketLocale} />
      </div>
    </main>
  );
}
