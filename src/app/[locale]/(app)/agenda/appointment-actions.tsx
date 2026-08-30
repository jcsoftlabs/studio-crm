'use client';

import { useTransition } from 'react';
import { Check, MoreVertical, Play, Trash2, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppointmentStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteAppointment, setAppointmentStatus } from './actions';

const TRANSITIONS = [
  { status: AppointmentStatus.CONFIRMED, icon: Check },
  { status: AppointmentStatus.IN_PROGRESS, icon: Play },
  { status: AppointmentStatus.DONE, icon: Check },
  { status: AppointmentStatus.NO_SHOW, icon: UserX },
] as const;

export function StatusMenu({ id, status }: { id: string; status: AppointmentStatus }) {
  const t = useTranslations('agenda');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('fields.status')} disabled={pending}>
          <MoreVertical className="size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TRANSITIONS.filter((entry) => entry.status !== status).map(({ status: next, icon: Icon }) => (
          <DropdownMenuItem
            key={next}
            onSelect={() => startTransition(() => void setAppointmentStatus(id, next))}
          >
            <Icon className="size-4" aria-hidden />
            {t(`status.${next}` as 'status.CONFIRMED')}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (!window.confirm(tc('confirmDelete'))) return;
            startTransition(() => void deleteAppointment(id));
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          {t('status.CANCELLED')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
