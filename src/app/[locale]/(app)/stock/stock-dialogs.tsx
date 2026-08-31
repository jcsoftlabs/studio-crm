'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { ArrowDownUp, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StockMovementType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { echoString } from '@/lib/form-echo';
import {
  addStockMovement,
  deleteProduct,
  deleteSupplier,
  saveProduct,
  saveSupplier,
  type StockState,
} from './actions';

type Option = { id: string; name: string };
export type ProductRow = {
  id: string;
  name: string;
  sku: string;
  costCents: number;
  priceCents: number;
  minStockQty: number;
  forResale: boolean;
  active: boolean;
  supplierId: string | null;
};

function useCloseOnSuccess(state: StockState, close: () => void) {
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);
}

export function ProductDialog({
  product,
  suppliers,
}: {
  product?: ProductRow;
  suppliers: Option[];
}) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StockState, FormData>(saveProduct, {});
  const [forResale, setForResale] = useState(product?.forResale ?? true);
  const [active, setActive] = useState(product?.active ?? true);
  useCloseOnSuccess(state, () => setOpen(false));

  const dv = (name: string, fallback: string) => echoString(state.echo, name, fallback);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {product ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            {t('newProduct')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{product ? tc('edit') : t('newProduct')}</DialogTitle>
        <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
        <form action={action} key={state.echo?.nonce ?? 0} className="mt-4 flex flex-col gap-4">
          {product ? <input type="hidden" name="id" value={product.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t('fields.name')}</Label>
              <Input id="name" name="name" required defaultValue={dv('name', product?.name ?? '')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sku">{t('fields.sku')}</Label>
              <Input id="sku" name="sku" defaultValue={dv('sku', product?.sku ?? '')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="costCents">{t('fields.costCents')}</Label>
              <Input
                id="costCents"
                name="costCents"
                inputMode="decimal"
                defaultValue={dv('costCents', product ? (product.costCents / 100).toString() : '')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priceCents">{t('fields.priceCents')}</Label>
              <Input
                id="priceCents"
                name="priceCents"
                inputMode="decimal"
                defaultValue={dv('priceCents', product ? (product.priceCents / 100).toString() : '')}
              />
            </div>
            {!product ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stockQty">{t('fields.stockQty')}</Label>
                <Input id="stockQty" name="stockQty" inputMode="numeric" defaultValue="0" />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minStockQty">{t('fields.minStockQty')}</Label>
              <Input
                id="minStockQty"
                name="minStockQty"
                inputMode="numeric"
                defaultValue={dv('minStockQty', String(product?.minStockQty ?? 0))}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="supplierId">{t('fields.supplier')}</Label>
              <Select id="supplierId" name="supplierId" defaultValue={product?.supplierId ?? ''}>
                <option value="">—</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Switch id="forResale" name="forResale" checked={forResale} onCheckedChange={setForResale} />
              <Label htmlFor="forResale">{t('fields.forResale')}</Label>
              {!forResale ? <input type="hidden" name="forResale" value="off" /> : null}
            </div>
            <p className="text-xs text-muted-foreground">{t('hints.forResale')}</p>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="active" name="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">{t('fields.active')}</Label>
            {!active ? <input type="hidden" name="active" value="off" /> : null}
          </div>

          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(state.error as 'generic')}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : tc('save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SupplierDialog({ supplier }: { supplier?: { id: string; name: string; phone: string; notes: string } }) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StockState, FormData>(saveSupplier, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {supplier ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline">
            <Truck className="size-4" aria-hidden />
            {t('newSupplier')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{supplier ? tc('edit') : t('newSupplier')}</DialogTitle>
        <DialogDescription className="sr-only">{t('suppliers')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-name">{t('fields.name')}</Label>
            <Input id="supplier-name" name="name" required defaultValue={supplier?.name ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-phone">{t('fields.phone')}</Label>
            <Input id="supplier-phone" name="phone" type="tel" defaultValue={supplier?.phone ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-notes">{t('fields.notes')}</Label>
            <Textarea id="supplier-notes" name="notes" defaultValue={supplier?.notes ?? ''} />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(state.error as 'generic')}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : tc('save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MovementDialog({ products }: { products: Option[] }) {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StockState, FormData>(addStockMovement, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowDownUp className="size-4" aria-hidden />
          {t('newMovement')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('newMovement')}</DialogTitle>
        <DialogDescription className="sr-only">{t('movements')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productId">{t('fields.name')}</Label>
            <Select id="productId" name="productId" required defaultValue="">
              <option value="">—</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">{t('fields.type')}</Label>
              <Select id="type" name="type" defaultValue={StockMovementType.PURCHASE}>
                {Object.values(StockMovementType)
                  .filter((value) => value !== StockMovementType.SALE)
                  .map((value) => (
                    <option key={value} value={value}>
                      {t(`type.${value}` as 'type.PURCHASE')}
                    </option>
                  ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qty">{t('fields.qty')}</Label>
              <Input id="qty" name="qty" inputMode="numeric" required />
              <p className="text-xs text-muted-foreground">{t('hints.qty')}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{tc('reason')}</Label>
            <Input id="reason" name="reason" />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(state.error as 'generic')}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : tc('save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveButton({ id, kind }: { id: string; kind: 'product' | 'supplier' }) {
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={tc('delete')}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(tc('confirmDelete'))) return;
        startTransition(() => void (kind === 'product' ? deleteProduct(id) : deleteSupplier(id)));
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
