'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { AppLocale, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { SETTINGS_ID } from '@/lib/settings';
import { hhmmToMinutes } from '@/lib/dates';
import { parseMoneyToCents, parseRateToBp } from '@/lib/money';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type SettingsState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  echo?: FormEcho;
};

const text = z.string().trim().max(200);

const schema = z.object({
  name: text,
  legalName: text,
  rnc: text,
  address: z.string().trim().max(400),
  city: text,
  province: text,
  phone: text,
  whatsapp: text,
  email: z.union([z.literal(''), z.string().trim().email()]),
  website: text,
  logoUrl: z.union([z.literal(''), z.string().trim().url()]),
  currencySymbol: z.string().trim().min(1).max(8),
  showUsd: z.boolean(),
  usdRateCents: z.number().int().positive().nullable(),
  itbisRateBp: z.number().int().min(0).max(10000),
  defaultCommissionRateBp: z.number().int().min(0).max(10000),
  invoiceFooterEs: z.string().trim().max(500),
  invoiceFooterFr: z.string().trim().max(500),
  printerWidthMm: z.number().int().min(40).max(120),
  ncfLowThreshold: z.number().int().min(0).max(100000),
  ncfExpiryWarningDays: z.number().int().min(0).max(365),
  allowSalesWithoutNcf: z.boolean(),
  defaultLocale: z.nativeEnum(AppLocale),
  timezone: z.string().trim().min(1).max(64),
});

function intField(formData: FormData, key: string, fallback: number) {
  const raw = String(formData.get(key) ?? '').trim();
  if (raw === '') return fallback;
  const value = Number(raw.replace(',', '.'));
  return Number.isFinite(value) ? Math.round(value) : NaN;
}

export async function updateStudioSettings(
  prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const echo = echoForm(prev.echo, formData);

  let userId: string;
  try {
    const user = await requireRole(Role.OWNER);
    userId = user.id;
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const rawUsd = String(formData.get('usdRate') ?? '').trim();
  const parsed = schema.safeParse({
    name: formData.get('name') ?? '',
    legalName: formData.get('legalName') ?? '',
    rnc: formData.get('rnc') ?? '',
    address: formData.get('address') ?? '',
    city: formData.get('city') ?? '',
    province: formData.get('province') ?? '',
    phone: formData.get('phone') ?? '',
    whatsapp: formData.get('whatsapp') ?? '',
    email: formData.get('email') ?? '',
    website: formData.get('website') ?? '',
    logoUrl: formData.get('logoUrl') ?? '',
    currencySymbol: formData.get('currencySymbol') ?? 'RD$',
    showUsd: formData.get('showUsd') === 'on',
    usdRateCents: rawUsd === '' ? null : parseMoneyToCents(rawUsd),
    itbisRateBp: parseRateToBp(String(formData.get('itbisRate') ?? '')),
    defaultCommissionRateBp: parseRateToBp(String(formData.get('defaultCommissionRate') ?? '')),
    invoiceFooterEs: formData.get('invoiceFooterEs') ?? '',
    invoiceFooterFr: formData.get('invoiceFooterFr') ?? '',
    printerWidthMm: intField(formData, 'printerWidthMm', 80),
    ncfLowThreshold: intField(formData, 'ncfLowThreshold', 50),
    ncfExpiryWarningDays: intField(formData, 'ncfExpiryWarningDays', 30),
    allowSalesWithoutNcf: formData.get('allowSalesWithoutNcf') !== 'off',
    defaultLocale: formData.get('defaultLocale') ?? 'es',
    timezone: formData.get('timezone') ?? 'America/Santo_Domingo',
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = 'invalid';
    }
    return { error: 'generic', fieldErrors, echo };
  }

  const hours: { weekday: number; closed: boolean; openMinute: number; closeMinute: number }[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const closed = formData.get(`closed-${weekday}`) === 'on';
    const openMinute = hhmmToMinutes(String(formData.get(`open-${weekday}`) ?? ''));
    const closeMinute = hhmmToMinutes(String(formData.get(`close-${weekday}`) ?? ''));
    if (openMinute === null || closeMinute === null) return { error: 'invalidTime', echo };
    if (!closed && closeMinute <= openMinute) return { error: 'closeBeforeOpen', echo };
    hours.push({ weekday, closed, openMinute, closeMinute });
  }

  const before = await prisma.studioSettings.findUnique({ where: { id: SETTINGS_ID } });

  await prisma.$transaction(async (tx) => {
    const after = await tx.studioSettings.upsert({
      where: { id: SETTINGS_ID },
      update: parsed.data,
      create: { id: SETTINGS_ID, ...parsed.data },
    });

    for (const h of hours) {
      await tx.businessHours.upsert({
        where: { settingsId_weekday: { settingsId: SETTINGS_ID, weekday: h.weekday } },
        update: h,
        create: { settingsId: SETTINGS_ID, ...h },
      });
    }

    await tx.auditLog.create({
      data: {
        userId,
        action: 'SETTINGS_UPDATE',
        entity: 'StudioSettings',
        entityId: SETTINGS_ID,
        before: before ? JSON.parse(JSON.stringify(before)) : undefined,
        after: JSON.parse(JSON.stringify(after)),
      },
    });
    // Base distante : le défaut de 5 s ne suffit pas pour sept upserts d'horaires.
  }, { timeout: 20_000, maxWait: 10_000 });

  revalidatePath('/', 'layout');
  return { ok: true };
}
