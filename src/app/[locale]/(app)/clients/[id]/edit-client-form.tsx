'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ClientFields, withEcho, type ClientDefaults } from '../client-fields';
import { updateClient, type ClientState } from '../actions';

export function EditClientForm({ id, defaults }: { id: string; defaults: ClientDefaults }) {
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<ClientState, FormData>(updateClient, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={id} />
      <ClientFields key={state.echo?.nonce ?? 0} defaults={withEcho(defaults, state.echo)} detailsOpen />

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        {state.ok ? <span className="text-sm text-muted-foreground">{tc('saved')}</span> : null}
        {state.error ? (
          <span role="alert" className="text-sm text-destructive">
            {te(state.error as 'generic')}
          </span>
        ) : null}
      </div>
    </form>
  );
}
