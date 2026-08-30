'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { addWaitlistEntry, resolveWaitlistEntry, type WaitlistState } from './actions';

type Option = { id: string; name: string };
export type WaitRow = {
  id: string;
  clientName: string;
  serviceName: string | null;
  employeeName: string | null;
  note: string;
  window: string | null;
};

export function WaitlistDialog({
  clients,
  services,
  employees,
}: {
  clients: Option[];
  services: Option[];
  employees: Option[];
}) {
  const t = useTranslations('agenda.waiting');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WaitlistState, FormData>(addWaitlistEntry, {});

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('add')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientId">{tc('nav.clients')}</Label>
            <Select id="clientId" name="clientId" required defaultValue="">
              <option value="">—</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serviceId">{tc('nav.services')}</Label>
              <Select id="serviceId" name="serviceId" defaultValue="">
                <option value="">{t('anyService')}</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employeeId">{tc('nav.staff')}</Label>
              <Select id="employeeId" name="employeeId" defaultValue="">
                <option value="">{t('anyEmployee')}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredFrom">{tc('previous')}</Label>
              <Input id="preferredFrom" name="preferredFrom" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preferredTo">{tc('next')}</Label>
              <Input id="preferredTo" name="preferredTo" type="date" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">{tc('nav.more')}</Label>
            <Textarea id="note" name="note" />
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

export function WaitlistRows({ rows }: { rows: WaitRow[] }) {
  const t = useTranslations('agenda.waiting');
  const [pending, startTransition] = useTransition();

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Card>
            <CardContent className="flex flex-wrap items-start gap-3 pt-5">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.clientName}</p>
                <p className="text-sm text-muted-foreground">
                  {[row.serviceName ?? t('anyService'), row.employeeName ?? t('anyEmployee')].join(' · ')}
                </p>
                {row.window ? <p className="text-sm text-muted-foreground">{row.window}</p> : null}
                {row.note ? <p className="pt-1 text-sm text-muted-foreground">{row.note}</p> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => void resolveWaitlistEntry(row.id))}
              >
                <Check className="size-4" aria-hidden />
                {t('resolve')}
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
