import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/auth';
import { routing } from '@/i18n/routing';

export type SessionUser = { id: string; name?: string | null; email?: string | null; role: Role };

export class ForbiddenError extends Error {
  constructor() {
    super('FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return session?.user ? (session.user as SessionUser) : null;
}

/** Garde pour les pages : redirige vers le login si la session est absente. */
export async function requireUser(locale: string = routing.defaultLocale): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);
  return user;
}

/** Garde pour les server actions : lève une erreur, ne redirige pas. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || !roles.includes(user.role)) throw new ForbiddenError();
  return user;
}

export function hasRole(user: SessionUser | null, ...roles: Role[]) {
  return !!user && roles.includes(user.role);
}

/**
 * §3.2 : une styliste ne voit que son propre agenda et les clientes qu'elle sert.
 * Renvoie l'employée à laquelle la restreindre, ou null si elle voit tout.
 */
export async function scopeToEmployee(user: SessionUser): Promise<string | null> {
  if (user.role !== Role.STYLIST) return null;
  const { prisma } = await import('@/lib/db');
  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  // Compte styliste sans fiche employée : on ne lui montre rien plutôt que tout.
  return employee?.id ?? '__none__';
}
