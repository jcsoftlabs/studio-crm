import { AlertTriangle } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { getStudioSettings } from '@/lib/settings';
import { formatMoney } from '@/lib/money';
import { formatInStudioTz } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MovementDialog, ProductDialog, RemoveButton, SupplierDialog } from './stock-dialogs';

export default async function StockPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations('stock');
  const tc = await getTranslations('common');
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

  const isOwner = user.role === Role.OWNER;
  const settings = await getStudioSettings();
  const money = (cents: number) => formatMoney(cents, appLocale, settings.currencySymbol);

  const [products, suppliers, movements] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: { supplier: { select: { name: true } } },
    }),
    prisma.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
    prisma.stockMovement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const low = products.filter((product) => product.stockQty <= product.minStockQty);
  const supplierOptions = suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));
  const productOptions = products.map((product) => ({ id: product.id, name: product.name }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {products.length > 0 ? <MovementDialog products={productOptions} /> : null}
          <SupplierDialog />
          {isOwner ? <ProductDialog suppliers={supplierOptions} /> : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {low.length > 0 ? <AlertTriangle className="size-4 text-destructive" aria-hidden /> : null}
            {t('lowStock')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {low.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('lowStockNone')}</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {low.map((product) => (
                <li key={product.id} className="flex justify-between">
                  <span>{product.name}</span>
                  <span className="text-destructive">
                    {product.stockQty} / {product.minStockQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {products.map((product) => (
                <li key={product.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {product.name}
                      <Badge variant="muted">
                        {product.forResale ? t('forResale') : t('internalUse')}
                      </Badge>
                      {!product.active ? <Badge variant="muted">{tc('inactive')}</Badge> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {product.sku ? `${product.sku} · ` : ''}
                      {tc('stockQty')} {product.stockQty}
                      {product.supplier ? ` · ${product.supplier.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {/* Un produit de cabine n'a ni prix de vente ni marge. */}
                    <p>{product.forResale ? money(product.priceCents) : money(product.costCents)}</p>
                    {isOwner && product.forResale ? (
                      <p className="text-muted-foreground">
                        {t('margin')} {money(product.priceCents - product.costCents)}
                      </p>
                    ) : null}
                  </div>
                  {isOwner ? (
                    <div className="flex items-center gap-1">
                      <ProductDialog product={product} suppliers={supplierOptions} />
                      <RemoveButton id={product.id} kind="product" />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('suppliers')}</CardTitle>
        </CardHeader>
        <CardContent>
          {suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSuppliers')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {suppliers.map((supplier) => (
                <li key={supplier.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{supplier.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{supplier.phone}</p>
                  </div>
                  <SupplierDialog supplier={supplier} />
                  {isOwner ? <RemoveButton id={supplier.id} kind="supplier" /> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('movements')}</CardTitle>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMovements')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {movements.map((movement) => (
                <li key={movement.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1 truncate">
                    {movement.product.name}
                    <span className="text-muted-foreground">
                      {' · '}
                      {t(`type.${movement.type}` as 'type.PURCHASE')}
                      {movement.reason ? ` · ${movement.reason}` : ''}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatInStudioTz(movement.createdAt, 'd MMM HH:mm', appLocale, settings.timezone)}
                  </span>
                  <span className={movement.qty < 0 ? 'text-destructive' : ''}>
                    {movement.qty > 0 ? `+${movement.qty}` : movement.qty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
