import { prisma } from '@/lib/db';

export const SETTINGS_ID = 'singleton';

const DEFAULT_HOURS = [
  { weekday: 0, closed: true, openMinute: 540, closeMinute: 1080 },
  { weekday: 1, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 2, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 3, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 4, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 5, closed: false, openMinute: 540, closeMinute: 1140 },
  { weekday: 6, closed: false, openMinute: 540, closeMinute: 1140 },
];

/**
 * Lecture d'abord. La création n'a lieu qu'au tout premier appel : écrire à
 * chaque affichage de page coûtait huit allers-retours vers une base distante,
 * sur toutes les pages du CRM.
 */
export async function getStudioSettings() {
  const existing = await prisma.studioSettings.findUnique({
    where: { id: SETTINGS_ID },
    include: { businessHours: { orderBy: { weekday: 'asc' } } },
  });

  if (existing && existing.businessHours.length === DEFAULT_HOURS.length) return existing;

  await prisma.studioSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });

  const missing = DEFAULT_HOURS.filter(
    (hours) => !existing?.businessHours.some((entry) => entry.weekday === hours.weekday),
  );
  if (missing.length > 0) {
    await prisma.businessHours.createMany({
      data: missing.map((hours) => ({ settingsId: SETTINGS_ID, ...hours })),
      skipDuplicates: true,
    });
  }

  return prisma.studioSettings.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    include: { businessHours: { orderBy: { weekday: 'asc' } } },
  });
}

export type StudioSettingsWithHours = Awaited<ReturnType<typeof getStudioSettings>>;
