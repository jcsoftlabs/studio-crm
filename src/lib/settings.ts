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

export async function getStudioSettings() {
  await prisma.studioSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });

  for (const hours of DEFAULT_HOURS) {
    await prisma.businessHours.upsert({
      where: { settingsId_weekday: { settingsId: SETTINGS_ID, weekday: hours.weekday } },
      update: {},
      create: { settingsId: SETTINGS_ID, ...hours },
    });
  }

  const settings = await prisma.studioSettings.findUniqueOrThrow({
    where: { id: SETTINGS_ID },
    include: { businessHours: { orderBy: { weekday: 'asc' } } },
  });

  return settings;
}

export type StudioSettingsWithHours = Awaited<ReturnType<typeof getStudioSettings>>;
