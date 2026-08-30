import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';
import { routing, locales } from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ['/login'];

function stripLocale(pathname: string) {
  const match = /^\/(es|fr)(?=\/|$)/.exec(pathname);
  if (!match) return { locale: null as string | null, rest: pathname };
  return { locale: match[1], rest: pathname.slice(match[0].length) || '/' };
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const { locale, rest } = stripLocale(pathname);
  const isPublic = PUBLIC_PATHS.some((p) => rest === p || rest.startsWith(`${p}/`));

  if (!req.auth && !isPublic) {
    const target = locale && locales.includes(locale as never) ? locale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${target}/login`, req.nextUrl));
  }

  if (req.auth && isPublic) {
    const target = locale && locales.includes(locale as never) ? locale : routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${target}`, req.nextUrl));
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
