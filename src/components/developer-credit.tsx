import { getTranslations } from 'next-intl/server';
import { DEVELOPER } from '@/lib/credits';

/** Discret et jamais imprimé : il n'a rien à faire sur un ticket de caisse. */
export async function DeveloperCredit({ className }: { className?: string }) {
  const t = await getTranslations('common');

  return (
    <footer className={className}>
      <p className="text-center text-xs text-muted-foreground">
        {t('developedBy')}{' '}
        {DEVELOPER.url ? (
          <a
            href={DEVELOPER.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {DEVELOPER.name}
          </a>
        ) : (
          <span className="text-foreground">{DEVELOPER.name}</span>
        )}
      </p>
    </footer>
  );
}
