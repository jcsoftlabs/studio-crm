'use client';

import { useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { setClientDeleted } from '../actions';

export function DeleteClient({ id, deleted }: { id: string; deleted: boolean }) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant={deleted ? 'outline' : 'ghost'}
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!deleted && !window.confirm(tc('confirmDelete'))) return;
        startTransition(() => void setClientDeleted(id, !deleted));
      }}
    >
      {deleted ? null : <Trash2 className="size-4" aria-hidden />}
      {deleted ? t('restore') : t('delete')}
    </Button>
  );
}
