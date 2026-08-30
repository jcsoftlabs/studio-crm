'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { FormEcho } from '@/lib/form-echo';

export const CLIENT_FIELD_NAMES = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'birthDate',
  'notes',
  'allergies',
  'preferences',
] as const;

export type ClientDefaults = Record<(typeof CLIENT_FIELD_NAMES)[number], string>;

/** Rejoue la saisie renvoyée par l'action par-dessus les valeurs du serveur. */
export function withEcho(defaults: ClientDefaults, echo: FormEcho | undefined): ClientDefaults {
  if (!echo) return defaults;
  const merged = { ...defaults };
  for (const field of CLIENT_FIELD_NAMES) {
    if (field in echo.values) merged[field] = echo.values[field];
  }
  return merged;
}

export const EMPTY_CLIENT: ClientDefaults = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
  notes: '',
  allergies: '',
  preferences: '',
};

export function ClientFields({
  defaults,
  detailsOpen = false,
}: {
  defaults: ClientDefaults;
  detailsOpen?: boolean;
}) {
  const t = useTranslations('clients');
  const tc = useTranslations('common');

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="firstName">{t('fields.firstName')}</Label>
          <Input id="firstName" name="firstName" required defaultValue={defaults.firstName} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lastName">
            {t('fields.lastName')} <span className="text-muted-foreground">({tc('optional')})</span>
          </Label>
          <Input id="lastName" name="lastName" defaultValue={defaults.lastName} />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="phone">{t('fields.phone')}</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={defaults.phone} />
        </div>
      </div>

      <details open={detailsOpen} className="rounded-md border border-border">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          {t('sections.care')}
        </summary>
        <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" name="email" type="email" defaultValue={defaults.email} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="birthDate">{t('fields.birthDate')}</Label>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={defaults.birthDate} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="allergies">{t('fields.allergies')}</Label>
            <Textarea id="allergies" name="allergies" defaultValue={defaults.allergies} />
            <p className="text-xs text-muted-foreground">{t('hints.allergies')}</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="preferences">{t('fields.preferences')}</Label>
            <Textarea id="preferences" name="preferences" defaultValue={defaults.preferences} />
            <p className="text-xs text-muted-foreground">{t('hints.preferences')}</p>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">{t('fields.notes')}</Label>
            <Textarea id="notes" name="notes" defaultValue={defaults.notes} />
          </div>
        </div>
      </details>
    </>
  );
}
