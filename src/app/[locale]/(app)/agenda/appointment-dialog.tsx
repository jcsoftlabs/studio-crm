'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AppointmentSource, type AppLocale } from '@prisma/client';
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
import { Textarea } from '@/components/ui/textarea';
import { minutesToHHmm } from '@/lib/dates';
import { echoArray, echoString, type FormEcho } from '@/lib/form-echo';
import { saveAppointment, type AgendaState } from './actions';

export type ClientOption = { id: string; name: string };
export type EmployeeOption = { id: string; name: string; color: string };
export type ServiceOption = { id: string; name: string; durationMin: number; categoryName: string };

export type AppointmentDefaults = {
  id?: string;
  clientId: string;
  employeeId: string;
  day: string;
  startTime: string;
  durationMin: number;
  serviceIds: string[];
  notes: string;
  source: AppointmentSource;
};

export function AppointmentDialog({
  clients,
  employees,
  services,
  defaults,
  trigger = 'button',
  open: openProp,
  onOpenChange,
}: {
  clients: ClientOption[];
  employees: EmployeeOption[];
  services: ServiceOption[];
  defaults: AppointmentDefaults;
  /** `none` : le dialogue est piloté par le parent (grille de l'agenda). */
  trigger?: 'button' | 'icon' | 'none';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('agenda');
  const tc = useTranslations('common');
  const locale = useLocale() as AppLocale;
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (value: boolean) => {
    if (!controlled) setOpenState(value);
    onOpenChange?.(value);
  };
  const [state, action, pending] = useActionState<AgendaState, FormData>(saveAppointment, {});

  useEffect(() => {
    if (!state.ok) return;
    if (!controlled) setOpenState(false);
    onOpenChange?.(false);
  }, [state.ok, controlled, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger === 'none' ? null : (
        <DialogTrigger asChild>
          {trigger === 'icon' ? (
            <Button variant="ghost" size="icon" aria-label={t('edit')}>
              <Pencil className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button>
              <Plus className="size-4" aria-hidden />
              {t('new')}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{defaults.id ? t('edit') : t('new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>

        <AppointmentForm
          key={state.echo?.nonce ?? 0}
          action={action}
          pending={pending}
          state={state}
          defaults={withEcho(defaults, state.echo)}
          clients={clients}
          employees={employees}
          services={services}
          locale={locale}
        />
      </DialogContent>
    </Dialog>
  );
}

export function defaultsForSlot(day: string, employeeId: string, minute: number): AppointmentDefaults {
  return {
    clientId: '',
    employeeId,
    day,
    startTime: minutesToHHmm(minute),
    durationMin: 60,
    serviceIds: [],
    notes: '',
    source: AppointmentSource.WALK_IN,
  };
}


/** Rejoue la saisie renvoyée par l'action : sans ça, un conflit vide le formulaire. */
function withEcho(defaults: AppointmentDefaults, echo: FormEcho | undefined): AppointmentDefaults {
  if (!echo) return defaults;
  const serviceIds = echoArray(echo, 'serviceIds');
  const duration = Number(echoString(echo, 'durationMin', String(defaults.durationMin)));
  return {
    ...defaults,
    clientId: echoString(echo, 'clientId', defaults.clientId),
    employeeId: echoString(echo, 'employeeId', defaults.employeeId),
    day: echoString(echo, 'day', defaults.day),
    startTime: echoString(echo, 'startTime', defaults.startTime),
    durationMin: Number.isFinite(duration) && duration > 0 ? duration : defaults.durationMin,
    serviceIds: serviceIds ?? defaults.serviceIds,
    notes: echoString(echo, 'notes', defaults.notes),
    source: (echoString(echo, 'source', defaults.source) as AppointmentSource) ?? defaults.source,
  };
}

function AppointmentForm({
  action,
  pending,
  state,
  defaults,
  clients,
  employees,
  services,
  locale,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  state: AgendaState;
  defaults: AppointmentDefaults;
  clients: ClientOption[];
  employees: EmployeeOption[];
  services: ServiceOption[];
  locale: AppLocale;
}) {
  const t = useTranslations('agenda');
  const tc = useTranslations('common');
  const te = useTranslations('errors');

  const [selectedServices, setSelectedServices] = useState<string[]>(defaults.serviceIds);
  const [duration, setDuration] = useState(defaults.durationMin);
  const [durationTouched, setDurationTouched] = useState(
    defaults.id !== undefined || defaults.serviceIds.length > 0,
  );

  const serviceById = useMemo(
    () => new Map(services.map((service) => [service.id, service])),
    [services],
  );

  // La durée est pré-remplie depuis les prestations, puis laissée à l'utilisatrice.
  useEffect(() => {
    if (durationTouched) return;
    const total = selectedServices.reduce(
      (sum, id) => sum + (serviceById.get(id)?.durationMin ?? 0),
      0,
    );
    if (total > 0) setDuration(total);
  }, [selectedServices, serviceById, durationTouched]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceOption[]>();
    for (const service of services) {
      const list = map.get(service.categoryName) ?? [];
      list.push(service);
      map.set(service.categoryName, list);
    }
    return [...map.entries()];
  }, [services]);

  const blocking = state.conflicts?.some((conflict) => conflict.blocking) ?? false;

  return (
    <form action={action} className="mt-4 flex flex-col gap-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="locale" value={locale} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="clientId">{t('fields.client')}</Label>
        <Select id="clientId" name="clientId" required defaultValue={defaults.clientId}>
          <option value="">—</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="employeeId">{t('fields.employee')}</Label>
        <Select id="employeeId" name="employeeId" required defaultValue={defaults.employeeId}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-sm font-medium">{t('fields.services')}</legend>
        <div className="max-h-52 overflow-y-auto rounded-md border border-border p-3">
          {grouped.map(([category, list]) => (
            <div key={category} className="pb-2 last:pb-0">
              <p className="pb-1 text-xs font-semibold text-muted-foreground">{category}</p>
              {list.map((service) => (
                <label key={service.id} className="flex items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    checked={selectedServices.includes(service.id)}
                    onChange={(event) =>
                      setSelectedServices((prev) =>
                        event.target.checked
                          ? [...prev, service.id]
                          : prev.filter((id) => id !== service.id),
                      )
                    }
                    className="size-4"
                  />
                  {service.name}
                  <span className="text-muted-foreground">{service.durationMin} min</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="day">{t('fields.date')}</Label>
          <Input id="day" name="day" type="date" required defaultValue={defaults.day} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="startTime">{t('fields.startTime')}</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            step={900}
            required
            defaultValue={defaults.startTime}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMin">{t('fields.durationMin')}</Label>
          <Input
            id="durationMin"
            name="durationMin"
            inputMode="numeric"
            required
            value={duration}
            onChange={(event) => {
              setDurationTouched(true);
              setDuration(Number(event.target.value) || 0);
            }}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t('hints.duration')}</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="source">{t('fields.source')}</Label>
        <Select id="source" name="source" defaultValue={defaults.source}>
          {Object.values(AppointmentSource).map((source) => (
            <option key={source} value={source}>
              {t(`source.${source}` as 'source.WALK_IN')}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">{t('fields.notes')}</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults.notes} />
      </div>

      {state.conflicts && state.conflicts.length > 0 ? (
        <div
          role="alert"
          className={
            blocking
              ? 'rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm'
              : 'rounded-md border border-border bg-muted p-3 text-sm'
          }
        >
          <ul className="flex flex-col gap-1">
            {state.conflicts.map((conflict, index) => (
              <li key={index}>
                {t(`conflicts.${conflict.kind}` as 'conflicts.OVERLAP', {
                  name: conflict.detail ?? '',
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.error && state.error !== 'conflict' ? (
        <p role="alert" className="text-sm text-destructive">
          {te(state.error as 'generic')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        {state.conflicts && state.conflicts.length > 0 && !blocking ? (
          <Button type="submit" name="force" value="1" variant="outline" disabled={pending}>
            {tc('forceAnyway')}
          </Button>
        ) : null}
      </div>
    </form>
  );
}