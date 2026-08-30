import { PrismaClient } from '@prisma/client';

// Vercel exécute chaque route dans un worker isolé : sans ce singleton et sans
// connection_limit dans l'URL, on épuise les connexions du Postgres hébergé.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
