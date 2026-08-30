import type { NextAuthConfig } from 'next-auth';
import type { AppLocale, Role } from '@prisma/client';

/**
 * Configuration compatible Edge (aucun import Prisma ni bcrypt) : elle est chargée
 * par le middleware. Le provider Credentials est ajouté dans src/auth.ts.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/es/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.locale = user.locale;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = token.role as Role;
        session.user.locale = token.locale as AppLocale;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
