'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from '@/i18n/navigation';
import { z } from 'zod';
import { AppLocale, PhotoType, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { buildSearchName, digitsOnly, displayName } from '@/lib/clients';
import { parseDateOnly } from '@/lib/dates';
import { buildPhotoKey, getStorage } from '@/lib/storage';
import { echoForm, type FormEcho } from '@/lib/form-echo';

export type ClientState = {
  ok?: boolean;
  error?: string;
  duplicateName?: string;
  fieldErrors?: Record<string, string>;
  echo?: FormEcho;
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const ALL_ROLES = [Role.OWNER, Role.RECEPTION, Role.STYLIST] as const;

const clientSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(''), z.string().trim().email()]),
  birthDate: z.date().nullable(),
  notes: z.string().trim().max(2000),
  allergies: z.string().trim().max(1000),
  preferences: z.string().trim().max(1000),
  locale: z.nativeEnum(AppLocale),
});

function readClient(formData: FormData) {
  const rawBirth = String(formData.get('birthDate') ?? '').trim();
  return clientSchema.safeParse({
    firstName: formData.get('firstName') ?? '',
    lastName: formData.get('lastName') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    birthDate: rawBirth === '' ? null : parseDateOnly(rawBirth),
    notes: formData.get('notes') ?? '',
    allergies: formData.get('allergies') ?? '',
    preferences: formData.get('preferences') ?? '',
    locale: formData.get('locale') ?? AppLocale.es,
  });
}

function toFieldErrors(issues: z.ZodIssue[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) fieldErrors[key] = 'invalid';
  }
  return fieldErrors;
}

export async function createClient(prev: ClientState, formData: FormData): Promise<ClientState> {
  const echo = echoForm(prev.echo, formData);

  try {
    await requireRole(...ALL_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const parsed = readClient(formData);
  if (!parsed.success) {
    return { error: 'nameRequired', fieldErrors: toFieldErrors(parsed.error.issues), echo };
  }

  const phoneDigits = digitsOnly(parsed.data.phone);
  const force = formData.get('force') === '1';

  // Deux clientes peuvent partager un numéro : on avertit, on ne bloque pas.
  if (phoneDigits !== '' && !force) {
    const existing = await prisma.client.findFirst({
      where: { phoneDigits, deletedAt: null },
      select: { firstName: true, lastName: true },
    });
    if (existing) return { error: 'duplicate', duplicateName: displayName(existing), echo };
  }

  const created = await prisma.client.create({
    data: {
      ...parsed.data,
      email: parsed.data.email === '' ? null : parsed.data.email,
      searchName: buildSearchName(parsed.data.firstName, parsed.data.lastName),
      phoneDigits,
    },
    select: { id: true },
  });

  revalidatePath('/clients', 'layout');
  redirect({ href: `/clients/${created.id}`, locale: String(formData.get('locale') ?? 'es') });
  return { ok: true }; // redirect() lève, cette ligne n'est là que pour le typage
}

export async function updateClient(prev: ClientState, formData: FormData): Promise<ClientState> {
  const echo = echoForm(prev.echo, formData);

  try {
    await requireRole(...ALL_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden', echo };
    throw error;
  }

  const id = String(formData.get('id') ?? '');
  if (id === '') return { error: 'notFound', echo };

  const parsed = readClient(formData);
  if (!parsed.success) {
    return { error: 'nameRequired', fieldErrors: toFieldErrors(parsed.error.issues), echo };
  }

  await prisma.client.update({
    where: { id },
    data: {
      ...parsed.data,
      email: parsed.data.email === '' ? null : parsed.data.email,
      searchName: buildSearchName(parsed.data.firstName, parsed.data.lastName),
      phoneDigits: digitsOnly(parsed.data.phone),
    },
  });

  revalidatePath('/clients', 'layout');
  return { ok: true };
}

export async function setClientDeleted(id: string, deleted: boolean) {
  await requireRole(Role.OWNER, Role.RECEPTION);
  // Suppression logique : on ne perd jamais l'historique d'une cliente (§3.3).
  await prisma.client.update({
    where: { id },
    data: { deletedAt: deleted ? new Date() : null },
  });
  revalidatePath('/clients', 'layout');
}

export async function addClientPhoto(_prev: ClientState, formData: FormData): Promise<ClientState> {
  try {
    await requireRole(...ALL_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }

  const clientId = String(formData.get('clientId') ?? '');
  const type = String(formData.get('type') ?? '') === 'AFTER' ? PhotoType.AFTER : PhotoType.BEFORE;
  const file = formData.get('file');

  if (!(file instanceof File) || file.size === 0) return { error: 'invalidFile' };
  if (file.size > MAX_PHOTO_BYTES) return { error: 'fileTooLarge' };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { error: 'invalidImage' };

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { error: 'notFound' };

  const key = buildPhotoKey(clientId, file.name);
  const stored = await getStorage().put(key, file);

  await prisma.clientPhoto.create({
    data: { clientId, type, url: stored.url, storageKey: stored.key },
  });

  revalidatePath(`/clients/${clientId}`, 'layout');
  return { ok: true };
}

export async function deleteClientPhoto(photoId: string) {
  await requireRole(...ALL_ROLES);
  const photo = await prisma.clientPhoto.findUnique({ where: { id: photoId } });
  if (!photo) return;

  await getStorage().remove(photo.storageKey);
  await prisma.clientPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/clients/${photo.clientId}`, 'layout');
}
