import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Amorçage d'une base réelle : uniquement les Paramètres du studio et un compte
 * propriétaire. Aucune donnée de démonstration — c'est le rôle de `db:seed`,
 * réservé au développement.
 *
 *   SEED_OWNER_EMAIL=... SEED_OWNER_PASSWORD=... npm run db:bootstrap
 */
const prisma = new PrismaClient();

const DEFAULT_HOURS = [
  { weekday: 0, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 1, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 2, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 3, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 4, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 5, closed: false, openMinute: 540, closeMinute: 1140 },
  { weekday: 6, closed: false, openMinute: 540, closeMinute: 1140 },
];

async function main() {
  const email = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD;
  const name = process.env.SEED_OWNER_NAME?.trim() || 'Propietaria';

  if (!email || !password) {
    throw new Error('SEED_OWNER_EMAIL et SEED_OWNER_PASSWORD sont obligatoires.');
  }
  if (password.length < 12) {
    throw new Error('SEED_OWNER_PASSWORD doit faire au moins 12 caractères.');
  }

  await prisma.studioSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  });

  for (const hours of DEFAULT_HOURS) {
    await prisma.businessHours.upsert({
      where: { settingsId_weekday: { settingsId: 'singleton', weekday: hours.weekday } },
      update: {},
      create: { settingsId: 'singleton', ...hours },
    });
  }

  const owner = await prisma.user.upsert({
    where: { email },
    update: { role: Role.OWNER, active: true },
    create: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.OWNER,
      locale: 'es',
    },
  });

  console.log(`Compte propriétaire prêt : ${owner.email}`);
  console.log('Séquences NCF : à saisir dans Paramètres → Séquences NCF (numéros de la DGII).');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
