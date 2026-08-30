'use client';

import { useState, useTransition } from 'react';
import { MessageCircle, Printer, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { voidInvoice } from '../../actions';

export function TicketButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline">
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Printer className="size-4" aria-hidden />
        {label}
      </a>
    </Button>
  );
}

export function ShareButton({ link }: { link: string }) {
  const tc = useTranslations('common');
  return (
    <Button asChild variant="outline">
      <a href={link} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" aria-hidden />
        {tc('share')}
      </a>
    </Button>
  );
}

export function VoidInvoiceDialog({ id }: { id: string }) {
  const t = useTranslations('facture');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <XCircle className="size-4" aria-hidden />
          {t('void')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogTitle>{t('void')}</DialogTitle>
        <DialogDescription>{t('voidWarning')}</DialogDescription>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voidReason">{t('voidReason')}</Label>
            <Input
              id="voidReason"
              required
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {te(error as 'generic')}
            </p>
          ) : null}
          <Button
            variant="destructive"
            disabled={pending || reason.trim() === ''}
            onClick={() =>
              startTransition(async () => {
                const result = await voidInvoice(id, reason);
                if (result.error) setError(result.error);
                else setOpen(false);
              })
            }
          >
            {pending ? tc('saving') : t('void')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
