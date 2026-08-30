'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { AppLocale } from '@prisma/client';
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
import { formatRateBp } from '@/lib/money';
import {
  deleteCategory,
  deletePackage,
  deleteService,
  moveCategory,
  saveCategory,
  savePackage,
  saveService,
  type CatalogState,
} from './actions';

type Category = { id: string; nameEs: string; nameFr: string; active: boolean };
type Service = {
  id: string;
  categoryId: string;
  nameEs: string;
  nameFr: string;
  durationMin: number;
  priceCents: number;
  commissionRateBp: number | null;
  active: boolean;
};
type Pack = {
  id: string;
  nameEs: string;
  nameFr: string;
  priceCents: number;
  sessionsTotal: number;
  validityDays: number;
  active: boolean;
};

function BilingualNames({ nameEs, nameFr }: { nameEs: string; nameFr: string }) {
  const t = useTranslations('services.fields');
  const th = useTranslations('services.hints');
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nameEs">{t('nameEs')}</Label>
        <Input id="nameEs" name="nameEs" required defaultValue={nameEs} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nameFr">{t('nameFr')}</Label>
        <Input id="nameFr" name="nameFr" required defaultValue={nameFr} />
        <p className="text-xs text-muted-foreground">{th('nameFr')}</p>
      </div>
    </>
  );
}

function ActiveSwitch({ active }: { active: boolean }) {
  const t = useTranslations('services.fields');
  const [checked, setChecked] = useState(active);
  return (
    <div className="flex items-center gap-3">
      <Switch id="active" name="active" checked={checked} onCheckedChange={setChecked} />
      <Label htmlFor="active">{t('active')}</Label>
      {!checked ? <input type="hidden" name="active" value="off" /> : null}
    </div>
  );
}

function useCloseOnSuccess(state: CatalogState, close: () => void) {
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);
}

export function CategoryDialog({ category }: { category?: Category }) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CatalogState, FormData>(saveCategory, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {category ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            {t('categories.new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{category ? tc('edit') : t('categories.new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('categories.title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <BilingualNames nameEs={category?.nameEs ?? ''} nameFr={category?.nameFr ?? ''} />
          <ActiveSwitch active={category?.active ?? true} />
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

export function ServiceDialog({
  categories,
  categoryId,
  service,
}: {
  categories: Category[];
  categoryId?: string;
  service?: Service;
}) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CatalogState, FormData>(saveService, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {service ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-4" aria-hidden />
            {t('items.new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{service ? tc('edit') : t('items.new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          {service ? <input type="hidden" name="id" value={service.id} /> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">{t('fields.category')}</Label>
            <Select
              id="categoryId"
              name="categoryId"
              required
              defaultValue={service?.categoryId ?? categoryId ?? ''}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {locale === 'es' ? category.nameEs : category.nameFr}
                </option>
              ))}
            </Select>
          </div>

          <BilingualNames nameEs={service?.nameEs ?? ''} nameFr={service?.nameFr ?? ''} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationMin">{t('fields.durationMin')}</Label>
              <Input
                id="durationMin"
                name="durationMin"
                inputMode="numeric"
                required
                defaultValue={service?.durationMin ?? 60}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">{t('fields.price')}</Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                required
                defaultValue={service ? (service.priceCents / 100).toString() : ''}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commissionRate">{t('fields.commissionRate')}</Label>
            <Input
              id="commissionRate"
              name="commissionRate"
              inputMode="decimal"
              defaultValue={
                service?.commissionRateBp != null ? formatRateBp(service.commissionRateBp, locale) : ''
              }
            />
            <p className="text-xs text-muted-foreground">{t('hints.commissionRate')}</p>
          </div>

          <ActiveSwitch active={service?.active ?? true} />

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

export function PackageDialog({ pack }: { pack?: Pack }) {
  const t = useTranslations('services');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CatalogState, FormData>(savePackage, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {pack ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-4" aria-hidden />
            {t('packages.new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{pack ? tc('edit') : t('packages.new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('packages.title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          {pack ? <input type="hidden" name="id" value={pack.id} /> : null}
          <BilingualNames nameEs={pack?.nameEs ?? ''} nameFr={pack?.nameFr ?? ''} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="price">{t('fields.price')}</Label>
              <Input
                id="price"
                name="price"
                inputMode="decimal"
                required
                defaultValue={pack ? (pack.priceCents / 100).toString() : ''}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sessionsTotal">{t('fields.sessionsTotal')}</Label>
              <Input
                id="sessionsTotal"
                name="sessionsTotal"
                inputMode="numeric"
                required
                defaultValue={pack?.sessionsTotal ?? 5}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validityDays">{t('fields.validityDays')}</Label>
              <Input
                id="validityDays"
                name="validityDays"
                inputMode="numeric"
                required
                defaultValue={pack?.validityDays ?? 90}
              />
            </div>
          </div>
          <ActiveSwitch active={pack?.active ?? true} />
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

export function CategoryControls({ id }: { id: string }) {
  const t = useTranslations('services.categories');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1">
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {te(error as 'generic')}
        </span>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('moveUp')}
        disabled={pending}
        onClick={() => startTransition(() => void moveCategory(id, -1))}
      >
        <ChevronUp className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('moveDown')}
        disabled={pending}
        onClick={() => startTransition(() => void moveCategory(id, 1))}
      >
        <ChevronDown className="size-4" aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={tc('delete')}
        disabled={pending}
        onClick={() => {
          if (!window.confirm(tc('confirmDelete'))) return;
          startTransition(async () => {
            const result = await deleteCategory(id);
            setError(result.error ?? null);
          });
        }}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function DeleteButton({ id, kind }: { id: string; kind: 'service' | 'package' }) {
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
        startTransition(() => void (kind === 'service' ? deleteService(id) : deletePackage(id)));
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
