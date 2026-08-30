import { AlertTriangle, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { displayName } from '@/lib/clients';

export async function ClientRow({
  client,
}: {
  client: { id: string; firstName: string; lastName: string; phone: string; allergies: string };
}) {
  const t = await getTranslations('clients');

  return (
    <li>
      <Link
        href={`/clients/${client.id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{displayName(client)}</p>
          <p className="truncate text-sm text-muted-foreground">
            {client.phone.trim() === '' ? t('noPhone') : client.phone}
          </p>
        </div>
        {client.allergies.trim() !== '' ? (
          <AlertTriangle className="size-4 shrink-0 text-destructive" aria-label={t('fields.allergies')} />
        ) : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
