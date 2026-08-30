'use server';

import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/permissions';
import { locales, type Locale } from '@/i18n/routing';

/** Le choix de langue est persisté sur le profil, pas seulement dans le navigateur (§3.1). */
export async function persistLocale(locale: Locale) {
  if (!locales.includes(locale)) return;
  const user = await getSessionUser();
  if (!user) return;
  await prisma.user.update({ where: { id: user.id }, data: { locale } });
}
