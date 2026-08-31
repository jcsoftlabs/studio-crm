'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ClientFields, EMPTY_CLIENT, withEcho } from '../client-fields';
import { createClient, type ClientState } from '../actions';
import { enqueue } from '@/lib/offline-queue';

export function NewClientForm() {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale();
  const [state, action, pending] = useActionState<ClientState, FormData>(createClient, {});
  const [queued, setQueued] = useState(false);
  const toff = useTranslations('offline');

  /** Hors ligne, la fiche part en file : au comptoir on ne perd pas une cliente. */
  async function handleSubmit(formData: FormData) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueue({
        kind: 'client.create',
        firstName: String(formData.get('firstName') ?? '').trim(),
        lastName: String(formData.get('lastName') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
      });
      setQueued(true);
      return;
    }
    action(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <ClientFields key={state.echo?.nonce ?? 0} defaults={withEcho(EMPTY_CLIENT, state.echo)} />

      {state.error === 'duplicate' ? (
        <div role="alert" className="rounded-md border border-border bg-muted p-3 text-sm">
          {t('duplicateWarning', { name: state.duplicateName ?? '' })}
        </div>
      ) : null}

      {queued ? (
        <p role="status" className="rounded-md border border-border bg-muted p-3 text-sm">
          {toff('queued', { count: 1 })}
        </p>
      ) : null}

      {state.error && state.error !== 'duplicate' ? (
        <p role="alert" className="text-sm text-destructive">
          {te(state.error as 'generic')}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {state.error === 'duplicate' ? (
          <Button type="submit" name="force" value="1" size="lg" disabled={pending}>
            {tc('confirm')}
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? tc('saving') : tc('save')}
          </Button>
        )}
      </div>
    </form>
  );
}
