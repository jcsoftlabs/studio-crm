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
import { enqueue } from '@/lib/offline-queue';

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

  /**
   * Hors ligne, le changement de statut part en file : c'est l'écriture la plus
   * utile pendant une coupure, et le serveur la revalide au rejeu.
   */
  function apply(next: AppointmentStatus) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      void enqueue({ kind: 'appointment.setStatus', appointmentId: id, status: next });
      return;
    }
    startTransition(() => void setAppointmentStatus(id, next));
  }

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
            onSelect={() => apply(next)}
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
