import { Plus, Upload } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Prisma } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { searchTerms } from '@/lib/clients';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ClientSearch } from './client-search';
import { ClientRow } from './client-row';

const PAGE_SIZE = 25;

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale);

  const { q = '', page: rawPage = '1' } = await searchParams;
  const t = await getTranslations('clients');
  const tc = await getTranslations('common');

  const page = Math.max(1, Number(rawPage) || 1);
  const { name, phone } = searchTerms(q);

  const filters: Prisma.ClientWhereInput[] = [];
  if (name !== '') filters.push({ searchName: { contains: name } });
  if (phone !== '') filters.push({ phoneDigits: { contains: phone } });

  const where: Prisma.ClientWhereInput = {
    deletedAt: null,
    ...(filters.length > 0 ? { OR: filters } : {}),
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, firstName: true, lastName: true, phone: true, allergies: true },
    }),
    prisma.client.count({ where }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/clients/import">
              <Upload className="size-4" aria-hidden />
              {t('importCta')}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clients/nouvelle">
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Link>
          </Button>
        </div>
      </div>

      <ClientSearch defaultValue={q} />

      {clients.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground">
            {q === '' ? t('empty') : t('noResults')}
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{tc('results', { count: total })}</p>
          <Card>
            <ul className="divide-y divide-border">
              {clients.map((client) => (
                <ClientRow key={client.id} client={client} />
              ))}
            </ul>
          </Card>
        </>
      )}

      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={{ pathname: '/clients', query: { q, page: page - 1 } }}>{tc('previous')}</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {pageCount}
          </span>
          <Button asChild variant="outline" size="sm" disabled={page >= pageCount}>
            <Link href={{ pathname: '/clients', query: { q, page: page + 1 } }}>{tc('next')}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
