'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { CalendarOff, Clock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SalaryType } from '@prisma/client';
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
import { minutesToHHmm } from '@/lib/dates';
import {
  addTimeOff,
  deleteEmployee,
  deleteTimeOff,
  saveEmployee,
  saveSchedule,
  type StaffState,
} from './actions';

type Employee = {
  id: string;
  name: string;
  phone: string;
  color: string;
  active: boolean;
  userId: string | null;
  salaryType: SalaryType;
  baseSalaryCents: number;
  commissionRateBp: number | null;
};
type Account = { id: string; name: string; email: string };
type Schedule = { weekday: number; closed: boolean; openMinute: number; closeMinute: number };

function useCloseOnSuccess(state: StaffState, close: () => void) {
  useEffect(() => {
    if (state.ok) close();
  }, [state.ok, close]);
}

export function EmployeeDialog({
  employee,
  accounts,
}: {
  employee?: Employee;
  accounts: Account[];
}) {
  const t = useTranslations('staff');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StaffState, FormData>(saveEmployee, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {employee ? (
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
        <DialogTitle>{employee ? tc('edit') : t('new')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          {employee ? <input type="hidden" name="id" value={employee.id} /> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">{t('fields.name')}</Label>
            <Input id="name" name="name" required defaultValue={employee?.name ?? ''} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">{t('fields.phone')}</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={employee?.phone ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="color">{t('fields.color')}</Label>
              <Input
                id="color"
                name="color"
                type="color"
                className="h-10 w-20 p-1"
                defaultValue={employee?.color ?? '#c084fc'}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="userId">{t('fields.account')}</Label>
            <Select id="userId" name="userId" defaultValue={employee?.userId ?? ''}>
              <option value="">{t('noAccount')}</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} — {account.email}
                </option>
              ))}
            </Select>
          </div>

          <SalaryFields employee={employee} />

          <ActiveField active={employee?.active ?? true} label={t('fields.active')} />

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

function SalaryFields({ employee }: { employee?: Employee }) {
  const t = useTranslations('staff');
  const tcom = useTranslations('commissions');
  const [salaryType, setSalaryType] = useState<SalaryType>(
    employee?.salaryType ?? SalaryType.COMMISSION,
  );

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="salaryType">{t('fields.salaryType')}</Label>
        <Select
          id="salaryType"
          name="salaryType"
          value={salaryType}
          onChange={(event) => setSalaryType(event.target.value as SalaryType)}
        >
          {Object.values(SalaryType).map((value) => (
            <option key={value} value={value}>
              {tcom(`salaryType.${value}` as 'salaryType.COMMISSION')}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {salaryType === SalaryType.COMMISSION ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="commissionRate">{t('fields.commissionRate')}</Label>
            <Input
              id="commissionRate"
              name="commissionRate"
              inputMode="decimal"
              defaultValue={
                employee?.commissionRateBp != null ? (employee.commissionRateBp / 100).toString() : ''
              }
            />
            <p className="text-xs text-muted-foreground">{t('hints.commissionRate')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="baseSalary">{t('fields.baseSalary')}</Label>
            <Input
              id="baseSalary"
              name="baseSalary"
              inputMode="decimal"
              defaultValue={employee ? (employee.baseSalaryCents / 100).toString() : ''}
            />
          </div>
        )}
      </div>
    </>
  );
}

function ActiveField({ active, label }: { active: boolean; label: string }) {
  const [checked, setChecked] = useState(active);
  return (
    <div className="flex items-center gap-3">
      <Switch id="active" name="active" checked={checked} onCheckedChange={setChecked} />
      <Label htmlFor="active">{label}</Label>
      {!checked ? <input type="hidden" name="active" value="off" /> : null}
    </div>
  );
}

export function ScheduleDialog({
  employeeId,
  schedules,
}: {
  employeeId: string;
  schedules: Schedule[];
}) {
  const t = useTranslations('staff.schedule');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StaffState, FormData>(saveSchedule, {});
  const [closedDays, setClosedDays] = useState<Record<number, boolean>>(
    Object.fromEntries(schedules.map((s) => [s.weekday, s.closed])),
  );
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('edit')}>
          <Clock className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('edit')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="employeeId" value={employeeId} />
          {schedules.map((schedule) => {
            const closed = closedDays[schedule.weekday] ?? schedule.closed;
            return (
              <div key={schedule.weekday} className="flex flex-wrap items-center gap-3">
                <WeekdayLabel weekday={schedule.weekday} />
                <div className="flex items-center gap-2">
                  <Switch
                    id={`closed-${schedule.weekday}`}
                    name={`closed-${schedule.weekday}`}
                    checked={closed}
                    onCheckedChange={(value) =>
                      setClosedDays((prev) => ({ ...prev, [schedule.weekday]: value }))
                    }
                  />
                  <Label htmlFor={`closed-${schedule.weekday}`} className="text-sm text-muted-foreground">
                    {tc('closed')}
                  </Label>
                </div>
                <Input
                  aria-label={`${t('title')} ${schedule.weekday}`}
                  name={`open-${schedule.weekday}`}
                  type="time"
                  disabled={closed}
                  defaultValue={minutesToHHmm(schedule.openMinute)}
                  className="w-28"
                />
                <Input
                  aria-label={`${t('title')} ${schedule.weekday} fin`}
                  name={`close-${schedule.weekday}`}
                  type="time"
                  disabled={closed}
                  defaultValue={minutesToHHmm(schedule.closeMinute)}
                  className="w-28"
                />
                {closed ? (
                  <>
                    <input type="hidden" name={`open-${schedule.weekday}`} value={minutesToHHmm(schedule.openMinute)} />
                    <input type="hidden" name={`close-${schedule.weekday}`} value={minutesToHHmm(schedule.closeMinute)} />
                  </>
                ) : null}
              </div>
            );
          })}
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

function WeekdayLabel({ weekday }: { weekday: number }) {
  const tc = useTranslations('common');
  return <span className="w-24 text-sm font-medium">{tc(`weekdays.${weekday}` as 'weekdays.0')}</span>;
}

export function TimeOffDialog({ employeeId }: { employeeId: string }) {
  const t = useTranslations('staff.timeOff');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StaffState, FormData>(addTimeOff, {});
  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('add')}>
          <CalendarOff className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('add')}</DialogTitle>
        <DialogDescription className="sr-only">{t('title')}</DialogDescription>
        <form action={action} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from">{t('from')}</Label>
              <Input id="from" name="from" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to">{t('to')}</Label>
              <Input id="to" name="to" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">{t('reason')}</Label>
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

export function RemoveButton({
  id,
  kind,
  label,
}: {
  id: string;
  kind: 'employee' | 'timeOff';
  label: string;
}) {
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      disabled={pending}
      onClick={() => {
        if (!window.confirm(tc('confirmDelete'))) return;
        startTransition(() =>
          void (kind === 'employee' ? deleteEmployee(id) : deleteTimeOff(id)),
        );
      }}
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
