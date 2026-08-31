import { PrismaClient } from '@prisma/client';

/**
 * Sur Vercel chaque instance de fonction ouvre son propre pool. Sans borne, une
 * poignée d'instances suffit à épuiser le quota de connexions du Postgres
 * hébergé — et l'application tombe entière avec un `too many clients`.
 *
 * La borne est donc appliquée ici, pas seulement documentée : une variable
 * d'environnement mal renseignée ne doit pas pouvoir mettre le studio à l'arrêt.
 */
function boundedUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  if (url.includes('connection_limit')) return url;

  const limit = process.env.NODE_ENV === 'production' ? 1 : 5;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=${limit}&pool_timeout=20`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const url = boundedUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
