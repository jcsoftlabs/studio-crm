import { ArrowLeft } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppointmentStatus } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser, scopeToEmployee } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { displayName } from '@/lib/clients';
import { formatInStudioTz } from '@/lib/dates';
import { addDaysToDay, localDayRange, todayInStudio } from '@/lib/agenda';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { fillTemplate } from '@/lib/whatsapp-templates';
import { getTemplate } from '@/lib/messages';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReminderList } from './reminder-list';

export default async function RemindersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('agenda.reminder');
  const tc = await getTranslations('common');

  const settings = await getStudioSettings();
  const tomorrow = addDaysToDay(todayInStudio(settings.timezone), 1);
  const { start, end } = localDayRange(tomorrow, settings.timezone);
  const scopedEmployeeId = await scopeToEmployee(user);

  const appointments = await prisma.appointment.findMany({
    where: {
      startAt: { gte: start, lt: end },
      status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED] },
      ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
    },
    orderBy: { startAt: 'asc' },
    include: { client: true, employee: { select: { name: true } } },
  });

  const rows = await Promise.all(appointments.map(async (appointment) => {
    // Chaque message suit la langue de la cliente (§3.1).
    const clientLocale = appointment.client.locale;
    const template = await getTemplate(clientLocale, 'agenda.reminder.template');
    const date = formatInStudioTz(appointment.startAt, 'EEEE d MMMM', clientLocale, settings.timezone);
    const time = formatInStudioTz(appointment.startAt, 'HH:mm', clientLocale, settings.timezone);
    const message = fillTemplate(template, {
      client: appointment.client.firstName,
      studio: settings.name.trim() || 'el studio',
      date,
      time,
    });
    return {
      id: appointment.id,
      clientName: displayName(appointment.client),
      employeeName: appointment.employee.name,
      time,
      message,
      link: appointment.client.phone.trim() === ''
        ? null
        : buildWhatsAppLink(appointment.client.phone, message),
    };
  }));

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/agenda">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">{t('empty')}</CardContent>
        </Card>
      ) : (
        <ReminderList rows={rows} />
      )}
    </div>
  );
}
