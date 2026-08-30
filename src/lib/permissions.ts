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
