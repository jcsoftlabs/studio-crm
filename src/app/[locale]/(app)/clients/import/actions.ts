'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ForbiddenError, requireRole } from '@/lib/permissions';
import { buildSearchName, digitsOnly } from '@/lib/clients';
import { parseFlexibleDate } from '@/lib/csv';

export type ImportRow = Record<string, string>;

export type ImportResult = { ok?: boolean; error?: string; imported?: number; skipped?: number };

const FIELDS = ['firstName', 'lastName', 'phone', 'email', 'birthDate', 'notes'] as const;

/**
 * L'import vient d'un export de contacts : on tolère les colonnes manquantes et on
 * ignore une ligne plutôt que d'échouer sur tout le fichier.
 */
export async function importClients(rows: ImportRow[]): Promise<ImportResult> {
  try {
    await requireRole(Role.OWNER, Role.RECEPTION);
  } catch (error) {
    if (error instanceof ForbiddenError) return { error: 'forbidden' };
    throw error;
  }

  if (!Array.isArray(rows) || rows.length === 0) return { error: 'invalidFile' };
  if (rows.length > 5000) return { error: 'fileTooLarge' };

  const payload: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    birthDate: Date | null;
    notes: string;
    searchName: string;
    phoneDigits: string;
  }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const values = Object.fromEntries(
      FIELDS.map((field) => [field, String(row[field] ?? '').trim()]),
    ) as Record<(typeof FIELDS)[number], string>;

    if (values.firstName === '' && values.lastName === '') {
      skipped += 1;
      continue;
    }

    const firstName = values.firstName === '' ? values.lastName : values.firstName;
    const lastName = values.firstName === '' ? '' : values.lastName;
    const email = values.email.includes('@') ? values.email : null;

    payload.push({
      firstName: firstName.slice(0, 80),
      lastName: lastName.slice(0, 80),
      phone: values.phone.slice(0, 40),
      email,
      birthDate: parseFlexibleDate(values.birthDate),
      notes: values.notes.slice(0, 2000),
      searchName: buildSearchName(firstName, lastName),
      phoneDigits: digitsOnly(values.phone),
    });
  }

  if (payload.length === 0) return { error: 'invalidFile', imported: 0, skipped };

  const created = await prisma.client.createMany({ data: payload });

  revalidatePath('/clients', 'layout');
  return { ok: true, imported: created.count, skipped };
}
