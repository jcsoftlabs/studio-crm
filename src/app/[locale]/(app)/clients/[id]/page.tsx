import { ArrowLeft, MessageCircle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { AppLocale } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { displayName } from '@/lib/clients';
import { buildWhatsAppLink } from '@/lib/whatsapp';
import { formatDateOnly, toDateInputValue } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditClientForm } from './edit-client-form';
import { PhotoGallery } from './photo-gallery';
import { DeleteClient } from './delete-client';

export default async function ClientPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireUser(locale);

  const client = await prisma.client.findUnique({
    where: { id },
    include: { photos: { orderBy: { takenAt: 'desc' } } },
  });
  if (!client) notFound();

  const t = await getTranslations('clients');
  const tc = await getTranslations('common');
  const waLink =
    client.phone.trim() === '' ? null : buildWhatsAppLink(client.phone, '');

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/clients">
          <ArrowLeft className="size-4" aria-hidden />
          {tc('back')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            {displayName(client)}
            {client.deletedAt ? <Badge variant="muted">{t('deleted')}</Badge> : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('createdOn', { date: formatDateOnly(client.createdAt, locale as AppLocale) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {waLink ? (
            <Button asChild variant="outline">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden />
                {t('whatsapp')}
              </a>
            </Button>
          ) : null}
          <DeleteClient id={client.id} deleted={client.deletedAt !== null} />
        </div>
      </div>

      {client.allergies.trim() !== '' ? (
        <div
          role="note"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
        >
          <strong>{t('fields.allergies')} : </strong>
          {client.allergies}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.contact')}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditClientForm
            id={client.id}
            defaults={{
              firstName: client.firstName,
              lastName: client.lastName,
              phone: client.phone,
              email: client.email ?? '',
              birthDate: toDateInputValue(client.birthDate),
              notes: client.notes,
              allergies: client.allergies,
              preferences: client.preferences,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.photos')}</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoGallery clientId={client.id} photos={client.photos} />
        </CardContent>
      </Card>
    </div>
  );
}
