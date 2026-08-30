'use client';

import { useActionState, useEffect, useState } from 'react';
import { ArrowDownUp, DoorOpen, Lock } from 'lucide-react';
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
import { formatMoney } from '@/lib/money';
import { addCashMovement, closeCashSession, openCashSession, type CashState } from './actions';

type Option = { id: string; name: string };

function useCloseOnSuccess(state: CashState, close: () => void) {
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);
}

export function OpenSessionDialog({ employees }: { employees: Option[] }) {
  const t = useTranslations('caisse');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CashState, FormData>(openCashSession, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <DoorOpen className="size-4" aria-hidden />
          {t('openTitle')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('openTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employeeId">{t('employee')}</Label>
            <Select id="employeeId" name="employeeId" required defaultValue="">
              <option value="">—</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="openingCents">{t('openingCents')}</Label>
            <Input id="openingCents" name="openingCents" inputMode="decimal" required defaultValue="0" />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(state.error as 'generic')}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : tc('open')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MovementDialog() {
  const t = useTranslations('caisse');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CashState, FormData>(addCashMovement, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ArrowDownUp className="size-4" aria-hidden />
          {t('addMovement')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('addMovement')}</DialogTitle>
        <DialogDescription className="sr-only">{t('movements')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">{t('movements')}</Label>
            <Select id="type" name="type" defaultValue="IN">
              <option value="IN">{t('movementIn')}</option>
              <option value="OUT">{t('movementOut')}</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amountCents">{tc('amount')}</Label>
            <Input id="amountCents" name="amountCents" inputMode="decimal" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{tc('reason')}</Label>
            <Input id="reason" name="reason" required />
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

export function CloseSessionDialog({
  expectedCents,
  currencySymbol,
}: {
  expectedCents: number;
  currencySymbol: string;
}) {
  const t = useTranslations('caisse');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [state, action, pending] = useActionState<CashState, FormData>(closeCashSession, {});
  useCloseOnSuccess(state, () => setOpen(false));

  const countedCents = Math.round((Number(counted.replace(',', '.')) || 0) * 100);
  const difference = countedCents - expectedCents;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Lock className="size-4" aria-hidden />
          {tc('close2')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('closeTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{tc('close2')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t('expectedCents')} : {formatMoney(expectedCents, locale, currencySymbol)}
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="countedCents">{t('countedCents')}</Label>
            <Input
              id="countedCents"
              name="countedCents"
              inputMode="decimal"
              required
              value={counted}
              onChange={(event) => setCounted(event.target.value)}
            />
          </div>
          {counted !== '' ? (
            <p className={difference === 0 ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
              {t('differenceCents')} : {formatMoney(difference, locale, currencySymbol)}
            </p>
          ) : null}
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(state.error as 'generic')}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? tc('saving') : t('closeConfirm')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
