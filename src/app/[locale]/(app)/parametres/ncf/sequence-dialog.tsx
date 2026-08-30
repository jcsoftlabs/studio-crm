'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Pencil, Plus, PowerOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NcfType } from '@prisma/client';
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
import { toDateInputValue } from '@/lib/dates';
import { echoString } from '@/lib/form-echo';
import { deactivateSequence, saveSequence, type NcfState } from './actions';

export type Sequence = {
  id: string;
  type: NcfType;
  prefix: string;
  currentNumber: number;
  maxNumber: number;
  expiresAt: Date | null;
  active: boolean;
};

export function SequenceDialog({ sequence }: { sequence?: Sequence }) {
  const t = useTranslations('ncf');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<NcfState, FormData>(saveSequence, {});
  const [active, setActive] = useState(sequence?.active ?? true);
  const [type, setType] = useState<NcfType>(sequence?.type ?? NcfType.B02);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  const dv = (name: string, fallback: string) => echoString(state.echo, name, fallback);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {sequence ? (
          <Button variant="ghost" size="icon" aria-label={tc('edit')}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" aria-hidden />
            {t('new')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{sequence ? tc('edit') : t('new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('subtitle')}</DialogDescription>
        <form action={action} key={state.echo?.nonce ?? 0} className="mt-4 flex flex-col gap-4">
          {sequence ? <input type="hidden" name="id" value={sequence.id} /> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">{t('type')}</Label>
            <Select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as NcfType)}
            >
              {Object.values(NcfType).map((value) => (
                <option key={value} value={value}>
                  {value.replace('_', '-')}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(`typeHint.${type}` as 'typeHint.B02')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prefix">{t('prefix')}</Label>
              <Input
                id="prefix"
                name="prefix"
                required
                placeholder="B02"
                defaultValue={dv('prefix', sequence?.prefix ?? '')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentNumber">{t('currentNumber')}</Label>
              <Input
                id="currentNumber"
                name="currentNumber"
                inputMode="numeric"
                required
                defaultValue={dv('currentNumber', String(sequence?.currentNumber ?? 0))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maxNumber">{t('maxNumber')}</Label>
              <Input
                id="maxNumber"
                name="maxNumber"
                inputMode="numeric"
                required
                defaultValue={dv('maxNumber', String(sequence?.maxNumber ?? 0))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expiresAt">{t('expiresAt')}</Label>
            <Input
              id="expiresAt"
              name="expiresAt"
              type="date"
              defaultValue={dv('expiresAt', toDateInputValue(sequence?.expiresAt))}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="active" name="active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="active">{t('active')}</Label>
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

export function DeactivateSequence({ id }: { id: string }) {
  const t = useTranslations('ncf');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t('active')}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(tc('confirmDelete'))) return;
        startTransition(() => void deactivateSequence(id));
      }}
    >
      <PowerOff className="size-4" aria-hidden />
    </Button>
  );
}
