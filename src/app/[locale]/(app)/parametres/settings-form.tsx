'use client';

import { useActionState, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AppLocale } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { minutesToHHmm } from '@/lib/dates';
import { formatRateBp } from '@/lib/money';
import { echoString } from '@/lib/form-echo';
import type { StudioSettingsWithHours } from '@/lib/settings';
import { updateStudioSettings, type SettingsState } from './actions';

type FieldKey = Parameters<ReturnType<typeof useTranslations<'parametres'>>>[0];

function Field({
  name,
  label,
  hint,
  className,
  ...props
}: { name: string; label: string; hint?: string; className?: string } & Omit<
  React.ComponentProps<'input'>,
  'className'
>) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function SettingsForm({ settings }: { settings: StudioSettingsWithHours }) {
  const t = useTranslations('parametres');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale() as AppLocale;
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateStudioSettings, {});
  const [showUsd, setShowUsd] = useState(settings.showUsd);
  const [allowWithoutNcf, setAllowWithoutNcf] = useState(settings.allowSalesWithoutNcf);
  const [closedDays, setClosedDays] = useState<Record<number, boolean>>(
    Object.fromEntries(settings.businessHours.map((h) => [h.weekday, h.closed])),
  );

  const f = (key: string) => t(`fields.${key}` as FieldKey);
  // Après une erreur, React a vidé les champs : on rejoue la saisie renvoyée par l'action.
  const dv = (name: string, fallback: string) => echoString(state.echo, name, fallback);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div key={state.echo?.nonce ?? 0} className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('sections.identity')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label={f('name')} defaultValue={dv('name', settings.name)} />
          <Field name="legalName" label={f('legalName')} defaultValue={dv('legalName', settings.legalName)} />
          <Field name="rnc" label={f('rnc')} defaultValue={dv('rnc', settings.rnc)} hint={t('hints.rnc')} />
          <Field name="logoUrl" label={f('logoUrl')} type="url" defaultValue={dv('logoUrl', settings.logoUrl ?? '')} />
          <Field name="address" label={f('address')} defaultValue={dv('address', settings.address)} className="sm:col-span-2" />
          <Field name="city" label={f('city')} defaultValue={dv('city', settings.city)} />
          <Field name="province" label={f('province')} defaultValue={dv('province', settings.province)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.contact')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="phone" label={f('phone')} type="tel" defaultValue={dv('phone', settings.phone)} />
          <Field name="whatsapp" label={f('whatsapp')} type="tel" defaultValue={dv('whatsapp', settings.whatsapp)} />
          <Field name="email" label={f('email')} type="email" defaultValue={dv('email', settings.email)} />
          <Field name="website" label={f('website')} defaultValue={dv('website', settings.website)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.fiscal')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            name="itbisRate"
            label={f('itbisRate')}
            inputMode="decimal"
            defaultValue={dv('itbisRate', formatRateBp(settings.itbisRateBp, locale))}
            hint={t('hints.itbisRate')}
          />
          <Field
            name="defaultCommissionRate"
            label={f('defaultCommissionRate')}
            inputMode="decimal"
            defaultValue={dv('defaultCommissionRate', formatRateBp(settings.defaultCommissionRateBp, locale))}
          />
          <Field name="currencySymbol" label={f('currencySymbol')} defaultValue={dv('currencySymbol', settings.currencySymbol)} />
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="showUsd" name="showUsd" checked={showUsd} onCheckedChange={setShowUsd} />
            <Label htmlFor="showUsd">{f('showUsd')}</Label>
          </div>
          {showUsd ? (
            <Field
              name="usdRate"
              label={f('usdRate')}
              inputMode="decimal"
              defaultValue={dv('usdRate', settings.usdRateCents ? (settings.usdRateCents / 100).toString() : '')}
              hint={t('hints.usdRate')}
            />
          ) : null}
          <Field
            name="printerWidthMm"
            label={f('printerWidthMm')}
            inputMode="numeric"
            defaultValue={dv('printerWidthMm', String(settings.printerWidthMm))}
            hint={t('hints.printerWidthMm')}
          />
          <Field
            name="ncfLowThreshold"
            label={f('ncfLowThreshold')}
            inputMode="numeric"
            defaultValue={dv('ncfLowThreshold', String(settings.ncfLowThreshold))}
          />
          <Field
            name="ncfExpiryWarningDays"
            label={f('ncfExpiryWarningDays')}
            inputMode="numeric"
            defaultValue={dv('ncfExpiryWarningDays', String(settings.ncfExpiryWarningDays))}
          />
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Switch
                id="allowSalesWithoutNcf"
                name="allowSalesWithoutNcf"
                checked={allowWithoutNcf}
                onCheckedChange={setAllowWithoutNcf}
              />
              <Label htmlFor="allowSalesWithoutNcf">{f('allowSalesWithoutNcf')}</Label>
              {!allowWithoutNcf ? (
                <input type="hidden" name="allowSalesWithoutNcf" value="off" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t('hints.allowSalesWithoutNcf')}</p>
          </div>
          <Field
            name="invoiceFooterEs"
            label={`${f('invoiceFooter')} (ES)`}
            defaultValue={dv('invoiceFooterEs', settings.invoiceFooterEs)}
          />
          <Field
            name="invoiceFooterFr"
            label={`${f('invoiceFooter')} (FR)`}
            defaultValue={dv('invoiceFooterFr', settings.invoiceFooterFr)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.hours')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {settings.businessHours.map((h) => {
            const closed = closedDays[h.weekday] ?? h.closed;
            return (
              <div key={h.weekday} className="flex flex-wrap items-center gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="w-28 text-sm font-medium">{tc(`weekdays.${h.weekday}` as 'weekdays.0')}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`closed-${h.weekday}`}
                    name={`closed-${h.weekday}`}
                    checked={closed}
                    onCheckedChange={(v) => setClosedDays((prev) => ({ ...prev, [h.weekday]: v }))}
                  />
                  <Label htmlFor={`closed-${h.weekday}`} className="text-sm text-muted-foreground">
                    {tc('closed')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={f('openMinute')}
                    name={`open-${h.weekday}`}
                    type="time"
                    disabled={closed}
                    defaultValue={dv(`open-${h.weekday}`, minutesToHHmm(h.openMinute))}
                    className="w-32"
                  />
                  <span aria-hidden>–</span>
                  <Input
                    aria-label={f('closeMinute')}
                    name={`close-${h.weekday}`}
                    type="time"
                    disabled={closed}
                    defaultValue={dv(`close-${h.weekday}`, minutesToHHmm(h.closeMinute))}
                    className="w-32"
                  />
                </div>
                {closed ? (
                  <>
                    <input type="hidden" name={`open-${h.weekday}`} value={minutesToHHmm(h.openMinute)} />
                    <input type="hidden" name={`close-${h.weekday}`} value={minutesToHHmm(h.closeMinute)} />
                  </>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="defaultLocale">{f('defaultLocale')}</Label>
            <select
              id="defaultLocale"
              name="defaultLocale"
              defaultValue={dv('defaultLocale', settings.defaultLocale)}
              className="h-10 rounded-md border border-input bg-card px-3 text-sm"
            >
              <option value="es">{tc('spanish')}</option>
              <option value="fr">{tc('french')}</option>
            </select>
          </div>
          <Field name="timezone" label={f('timezone')} defaultValue={dv('timezone', settings.timezone)} />
          <Field
            name="loyaltyPoints"
            label={f('loyaltyPoints')}
            inputMode="numeric"
            defaultValue={dv('loyaltyPoints', String(settings.loyaltyPointsPer100Cents))}
            hint={t('hints.loyaltyPoints')}
          />
          <Field
            name="inactiveAfterDays"
            label={f('inactiveAfterDays')}
            inputMode="numeric"
            defaultValue={dv('inactiveAfterDays', String(settings.inactiveAfterDays))}
          />
        </CardContent>
      </Card>

      </div>

      <div className="sticky bottom-20 flex items-center gap-3 md:bottom-4">
        <Button type="submit" size="lg" disabled={pending}>
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
