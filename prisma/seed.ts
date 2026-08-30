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

  await seedCatalog();
  await seedClients();
}

const CATEGORIES = [
  {
    nameEs: 'Uñas',
    nameFr: 'Ongles',
    services: [
      { nameEs: 'Manicure clásico', nameFr: 'Manucure classique', durationMin: 45, price: 800 },
      { nameEs: 'Manicure en gel', nameFr: 'Manucure en gel', durationMin: 75, price: 1500 },
      { nameEs: 'Uñas acrílicas', nameFr: 'Ongles acryliques', durationMin: 120, price: 2500 },
      { nameEs: 'Pedicure spa', nameFr: 'Pédicure spa', durationMin: 60, price: 1200 },
    ],
  },
  {
    nameEs: 'Cabello',
    nameFr: 'Cheveux',
    services: [
      { nameEs: 'Lavado y secado', nameFr: 'Shampoing et brushing', durationMin: 45, price: 900 },
      { nameEs: 'Corte de dama', nameFr: 'Coupe femme', durationMin: 60, price: 1400 },
      { nameEs: 'Tinte completo', nameFr: 'Coloration complète', durationMin: 150, price: 4500 },
      { nameEs: 'Alisado', nameFr: 'Lissage', durationMin: 180, price: 6500 },
      { nameEs: 'Tratamiento capilar', nameFr: 'Soin capillaire', durationMin: 60, price: 1800 },
    ],
  },
  {
    nameEs: 'Cuidados',
    nameFr: 'Soins',
    services: [
      { nameEs: 'Limpieza facial', nameFr: 'Nettoyage de peau', durationMin: 60, price: 2200 },
      { nameEs: 'Depilación de cejas', nameFr: 'Épilation des sourcils', durationMin: 20, price: 500 },
      { nameEs: 'Masaje relajante', nameFr: 'Massage relaxant', durationMin: 60, price: 2800 },
    ],
  },
  {
    nameEs: 'Maquillaje',
    nameFr: 'Maquillage',
    services: [
      { nameEs: 'Maquillaje de día', nameFr: 'Maquillage de jour', durationMin: 45, price: 1800 },
      { nameEs: 'Maquillaje de novia', nameFr: 'Maquillage de mariée', durationMin: 120, price: 7500 },
      { nameEs: 'Pestañas postizas', nameFr: 'Pose de faux cils', durationMin: 40, price: 1200 },
    ],
  },
];

const PACKAGES = [
  { nameEs: 'Paquete 5 manicures', nameFr: 'Forfait 5 manucures', price: 3500, sessionsTotal: 5, validityDays: 120 },
  { nameEs: 'Paquete novia', nameFr: 'Forfait mariée', price: 12000, sessionsTotal: 3, validityDays: 60 },
];

async function seedCatalog() {
  for (const [index, category] of CATEGORIES.entries()) {
    const existing = await prisma.serviceCategory.findFirst({
      where: { nameEs: category.nameEs, deletedAt: null },
    });
    const record =
      existing ??
      (await prisma.serviceCategory.create({
        data: { nameEs: category.nameEs, nameFr: category.nameFr, order: index },
      }));

    for (const [position, service] of category.services.entries()) {
      const found = await prisma.service.findFirst({
        where: { nameEs: service.nameEs, categoryId: record.id, deletedAt: null },
      });
      if (found) continue;
      await prisma.service.create({
        data: {
          categoryId: record.id,
          nameEs: service.nameEs,
          nameFr: service.nameFr,
          durationMin: service.durationMin,
          priceCents: service.price * 100,
          order: position,
        },
      });
    }
  }

  for (const pack of PACKAGES) {
    const found = await prisma.package.findFirst({ where: { nameEs: pack.nameEs, deletedAt: null } });
    if (found) continue;
    await prisma.package.create({
      data: {
        nameEs: pack.nameEs,
        nameFr: pack.nameFr,
        priceCents: pack.price * 100,
        sessionsTotal: pack.sessionsTotal,
        validityDays: pack.validityDays,
      },
    });
  }

  const services = await prisma.service.count({ where: { deletedAt: null } });
  console.log(`Catalogue : ${CATEGORIES.length} categorias, ${services} servicios, ${PACKAGES.length} paquetes`);
}

const FIRST_NAMES = ['Ana', 'Carmen', 'Yamilet', 'Rosanna', 'Massiel', 'Yokasta', 'Perla', 'Nurys', 'Clarissa', 'Wendy', 'Ivelisse', 'Scarlet', 'Dahiana', 'Yaritza', 'Nathalie', 'Solange', 'Mariela', 'Katherine', 'Larissa', 'Esmeralda'];
const LAST_NAMES = ['Peña', 'Reyes', 'Santos', 'Jiménez', 'Núñez', 'Batista', 'Guzmán', 'Ramírez', 'Feliz', 'Mejía', 'Cabrera', 'Ortiz', 'Vásquez', 'Almonte', 'Paulino', 'Encarnación', 'Herrera', 'Polanco', 'Tavárez', 'Marte'];
const ALLERGIES = ['', '', '', 'Alergia al látex', '', 'Acetona: irritación', '', '', 'Amoníaco', ''];
const PREFERENCES = ['Prefiere tonos nude', 'Uñas cortas', 'Sin fragancia', 'Cita temprano en la mañana', '', '', 'Siempre con Yamilet', ''];

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function seedClients() {
  const areaCodes = ['809', '829', '849'];

  for (let index = 0; index < FIRST_NAMES.length; index += 1) {
    const firstName = FIRST_NAMES[index];
    const lastName = LAST_NAMES[index];
    const phone = `${areaCodes[index % 3]}-${String(200 + index * 7).padStart(3, '0')}-${String(1000 + index * 137).slice(0, 4)}`;
    const phoneDigits = phone.replace(/\D/g, '');

    const existing = await prisma.client.findFirst({ where: { phoneDigits } });
    if (existing) continue;

    await prisma.client.create({
      data: {
        firstName,
        lastName,
        phone,
        email: index % 4 === 0 ? `${firstName.toLowerCase()}@example.do` : null,
        birthDate: new Date(Date.UTC(1985 + (index % 20), index % 12, ((index * 3) % 27) + 1)),
        allergies: ALLERGIES[index % ALLERGIES.length],
        preferences: PREFERENCES[index % PREFERENCES.length],
        notes: '',
        searchName: normalize(`${firstName} ${lastName}`),
        phoneDigits,
      },
    });
  }

  const total = await prisma.client.count({ where: { deletedAt: null } });
  console.log(`Clientas : ${total}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
