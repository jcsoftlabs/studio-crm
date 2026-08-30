'use client';

import Image from 'next/image';
import { useActionState, useRef, useState, useTransition } from 'react';
import { Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PhotoType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { addClientPhoto, deleteClientPhoto, type ClientState } from '../actions';

type Photo = { id: string; url: string; type: PhotoType; takenAt: Date };

export function PhotoGallery({ clientId, photos }: { clientId: string; photos: Photo[] }) {
  const t = useTranslations('clients.photos');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<ClientState, FormData>(addClientPhoto, {});
  const [type, setType] = useState<'BEFORE' | 'AFTER'>('BEFORE');
  const formRef = useRef<HTMLFormElement>(null);
  const [, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="type" value={type} />
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          id="photo-input"
          onChange={() => formRef.current?.requestSubmit()}
        />
        {(['BEFORE', 'AFTER'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setType(value);
              document.getElementById('photo-input')?.click();
            }}
          >
            <Upload className="size-4" aria-hidden />
            {`${t('add')} — ${value === 'BEFORE' ? t('before') : t('after')}`}
          </Button>
        ))}
        {pending ? <span className="text-sm text-muted-foreground">{t('uploading')}</span> : null}
        {state.error ? (
          <span role="alert" className="text-sm text-destructive">
            {te(state.error as 'generic')}
          </span>
        ) : null}
      </form>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="group relative overflow-hidden rounded-md border border-border">
              <Image
                src={photo.url}
                alt={photo.type === 'BEFORE' ? t('before') : t('after')}
                width={400}
                height={400}
                className="aspect-square w-full object-cover"
                unoptimized
              />
              <Badge variant="muted" className="absolute left-2 top-2">
                {photo.type === 'BEFORE' ? t('before') : t('after')}
              </Badge>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                aria-label={t('delete')}
                className="absolute right-2 top-2 size-8"
                onClick={() => startTransition(() => void deleteClientPhoto(photo.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
