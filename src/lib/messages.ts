import type { AppLocale } from '@prisma/client';

type MessageTree = Record<string, unknown>;

const cache = new Map<AppLocale, MessageTree>();

/**
 * Messages bruts d'une langue donnée. Sert aux textes qui partent vers la cliente :
 * ils suivent sa langue, pas celle de l'utilisatrice connectée (§3.1).
 */
export async function getMessagesFor(locale: AppLocale): Promise<MessageTree> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const loaded = (await import(`../../messages/${locale}.json`)).default as MessageTree;
  cache.set(locale, loaded);
  return loaded;
}

export async function getTemplate(locale: AppLocale, path: string): Promise<string> {
  const messages = await getMessagesFor(locale);
  const value = path.split('.').reduce<unknown>(
    (node, key) => (node && typeof node === 'object' ? (node as MessageTree)[key] : undefined),
    messages,
  );
  return typeof value === 'string' ? value : '';
}
