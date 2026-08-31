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
  // Ce jeu de données est fictif : 20 clientes, une semaine de rendez-vous, un bon
  // cadeau et une séquence NCF de test. Il n'a rien à faire sur une base réelle.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'yes') {
    throw new Error(
      'db:seed insère des données de démonstration. Utilisez db:bootstrap en production.',
    );
  }

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
  await seedEmployees();
  await seedAppointments();
  await seedNcf();
  await seedStock();
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


const EMPLOYEES = [
  { name: 'Yamilet', color: '#e879f9', phone: '809-555-0101' },
  { name: 'Rosanna', color: '#38bdf8', phone: '829-555-0102' },
  { name: 'Massiel', color: '#fbbf24', phone: '849-555-0103' },
];

const EMPLOYEE_HOURS = [
  { weekday: 0, closed: true, openMinute: 540, closeMinute: 1080 },
  { weekday: 1, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 2, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 3, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 4, closed: false, openMinute: 540, closeMinute: 1080 },
  { weekday: 5, closed: false, openMinute: 540, closeMinute: 1140 },
  { weekday: 6, closed: false, openMinute: 540, closeMinute: 1140 },
];

async function seedStaffAccount(email: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, active: true },
    create: { email, name, passwordHash, role, locale: 'es' },
  });
}

async function seedEmployees() {
  await seedStaffAccount('recepcion@studio.do', 'Recepción', Role.RECEPTION);
  // Yamilet a un compte styliste : c'est le cas qui exerce la restriction du §3.2.
  const stylistUser = await seedStaffAccount('yamilet@studio.do', 'Yamilet', Role.STYLIST);

  for (const [index, employee] of EMPLOYEES.entries()) {
    const existing = await prisma.employee.findFirst({
      where: { name: employee.name, deletedAt: null },
    });
    if (existing) {
      if (employee.name === 'Yamilet' && existing.userId === null) {
        await prisma.employee.update({ where: { id: existing.id }, data: { userId: stylistUser.id } });
      }
      continue;
    }

    const created = await prisma.employee.create({
      data: {
        ...employee,
        order: index,
        userId: employee.name === 'Yamilet' ? stylistUser.id : null,
      },
    });
    await prisma.employeeSchedule.createMany({
      data: EMPLOYEE_HOURS.map((hours) => ({ employeeId: created.id, ...hours })),
    });
  }
  console.log(`Empleadas : ${await prisma.employee.count({ where: { deletedAt: null } })}`);
}

/** Santo Domingo est à UTC-4 toute l'année : pas d'heure d'été à gérer ici. */
const STUDIO_OFFSET_HOURS = 4;

function studioDate(day: Date, minutes: number): Date {
  const stamp = new Date(day);
  stamp.setUTCHours(0, 0, 0, 0);
  return new Date(stamp.getTime() + (minutes + STUDIO_OFFSET_HOURS * 60) * 60000);
}

async function seedAppointments() {
  const existing = await prisma.appointment.count();
  if (existing > 0) {
    console.log(`Citas : ${existing} (ya sembradas)`);
    return;
  }

  const employees = await prisma.employee.findMany({
    where: { deletedAt: null },
    orderBy: { order: 'asc' },
  });
  const clients = await prisma.client.findMany({ where: { deletedAt: null }, take: 20 });
  const services = await prisma.service.findMany({ where: { deletedAt: null } });
  if (employees.length === 0 || clients.length === 0 || services.length === 0) return;

  // Une semaine à partir du lundi courant, heure du studio.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));

  let created = 0;
  let cursor = 0;

  for (let dayOffset = 0; dayOffset < 6; dayOffset += 1) {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + dayOffset);

    for (const [employeeIndex, employee] of employees.entries()) {
      let minute = 9 * 60 + employeeIndex * 30;

      for (let slot = 0; slot < 3; slot += 1) {
        const client = clients[cursor % clients.length];
        const service = services[(cursor * 3 + employeeIndex) % services.length];
        cursor += 1;

        const startAt = studioDate(day, minute);
        const endAt = new Date(startAt.getTime() + service.durationMin * 60000);
        if (minute + service.durationMin > 18 * 60) break;

        await prisma.appointment.create({
          data: {
            clientId: client.id,
            employeeId: employee.id,
            startAt,
            endAt,
            status: dayOffset < 2 ? 'DONE' : 'SCHEDULED',
            source: slot === 0 ? 'PHONE' : 'WALK_IN',
            items: {
              create: [
                {
                  serviceId: service.id,
                  employeeId: employee.id,
                  priceCents: service.priceCents,
                  durationMin: service.durationMin,
                  order: 0,
                },
              ],
            },
          },
        });

        created += 1;
        minute += service.durationMin + 15;
      }
    }
  }

  console.log(`Citas : ${created}`);
}

async function seedNcf() {
  const existing = await prisma.ncfSequence.findFirst({ where: { type: 'B02' } });
  if (!existing) {
    // Séquence de test : les vrais numéros viennent de la DGII et se saisissent
    // dans Paramètres → Séquences NCF.
    const expiresAt = new Date();
    expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
    await prisma.ncfSequence.create({
      data: { type: 'B02', prefix: 'B02', currentNumber: 0, maxNumber: 1000, expiresAt },
    });
  }

  const cardCode = 'REGALO-2026';
  const card = await prisma.giftCard.findUnique({ where: { code: cardCode } });
  if (!card) {
    await prisma.giftCard.create({
      data: { code: cardCode, amountCents: 200000, balanceCents: 200000 },
    });
  }

  console.log(`NCF : ${await prisma.ncfSequence.count()} secuencia(s), bono ${cardCode}`);
}

const SUPPLIERS = [
  { name: 'Distribuidora Bella', phone: '809-555-0200' },
  { name: 'Beauty Import RD', phone: '829-555-0201' },
];

const PRODUCTS = [
  { name: 'Esmalte gel rojo', sku: 'GEL-001', cost: 180, price: 450, stock: 24, min: 6, forResale: true },
  { name: 'Removedor de acetona', sku: 'ACE-001', cost: 90, price: 0, stock: 12, min: 4, forResale: false },
  { name: 'Shampoo hidratante 1L', sku: 'SHA-001', cost: 420, price: 950, stock: 8, min: 3, forResale: true },
  { name: 'Mascarilla capilar', sku: 'MAS-001', cost: 350, price: 800, stock: 2, min: 5, forResale: true },
  { name: 'Tinte castaño', sku: 'TIN-001', cost: 260, price: 0, stock: 15, min: 5, forResale: false },
];

async function seedStock() {
  for (const supplier of SUPPLIERS) {
    const found = await prisma.supplier.findFirst({ where: { name: supplier.name, deletedAt: null } });
    if (!found) await prisma.supplier.create({ data: supplier });
  }

  const suppliers = await prisma.supplier.findMany({ where: { deletedAt: null } });

  for (const [index, product] of PRODUCTS.entries()) {
    const found = await prisma.product.findFirst({ where: { sku: product.sku, deletedAt: null } });
    if (found) continue;

    const created = await prisma.product.create({
      data: {
        name: product.name,
        sku: product.sku,
        costCents: product.cost * 100,
        priceCents: product.price * 100,
        stockQty: product.stock,
        minStockQty: product.min,
        forResale: product.forResale,
        supplierId: suppliers[index % suppliers.length]?.id ?? null,
      },
    });
    await prisma.stockMovement.create({
      data: {
        productId: created.id,
        type: 'PURCHASE',
        qty: product.stock,
        reason: 'inventario inicial',
      },
    });
  }

  console.log(`Inventario : ${await prisma.product.count({ where: { deletedAt: null } })} productos`);
}