import type { AppLocale, Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: Role;
    locale: AppLocale;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      locale: AppLocale;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: Role;
    locale: AppLocale;
  }
}
