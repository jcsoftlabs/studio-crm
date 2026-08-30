import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'owner@studio.do';
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? 'Studio2026!';
const OWNER_NAME = process.env.SEED_OWNER_NAME ?? 'Propietaria';

const DEFAULT_HOURS = [
  { weekday: 0, closed: true, openMinute: 540, closeMinute: 1080 },
  { weekday: 1, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 2, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 3, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 4, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 5, closed: false, openMinute: 540, closeMinute: 1140 },
  { weekday: 6, closed: false, openMinute: 540, closeMinute: 1140 },
];

async function main() {
  await prisma.studioSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', itbisRateBp: 1800, currencySymbol: 'RD$' },
  });

  for (const hours of DEFAULT_HOURS) {
    await prisma.businessHours.upsert({
      where: { settingsId_weekday: { settingsId: 'singleton', weekday: hours.weekday } },
      update: {},
      create: { settingsId: 'singleton', ...hours },
    });
  }

  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL.toLowerCase() },
    update: { name: OWNER_NAME, role: Role.OWNER, active: true },
    create: {
      email: OWNER_EMAIL.toLowerCase(),
      name: OWNER_NAME,
      passwordHash,
      role: Role.OWNER,
      locale: 'es',
    },
  });

  console.log(`OWNER: ${owner.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
