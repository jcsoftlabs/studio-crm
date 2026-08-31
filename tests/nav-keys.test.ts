import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '../src/lib/nav';
import es from '../messages/es.json';
import fr from '../messages/fr.json';

/**
 * La parité seule ne suffit pas : une clé absente des DEUX langues passe le test
 * de parité et casse le rendu à l'exécution. Ici on vérifie qu'elle existe.
 */
describe('clés de navigation', () => {
  const messages = { es, fr } as Record<string, { common: { nav: Record<string, string> } }>;

  for (const locale of ['es', 'fr']) {
    it(`toutes les entrées du menu ont un libellé en ${locale}`, () => {
      const missing = NAV_ITEMS.filter((item) => !messages[locale].common.nav[item.key]).map(
        (item) => item.key,
      );
      expect(missing).toEqual([]);
    });
  }

  it('les statuts de rendez-vous ont tous un libellé', () => {
    const statuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'NO_SHOW', 'CANCELLED'];
    for (const locale of ['es', 'fr'] as const) {
      const tree = (locale === 'es' ? es : fr) as unknown as {
        agenda: { status: Record<string, string> };
      };
      expect(statuses.filter((status) => !tree.agenda.status[status])).toEqual([]);
    }
  });
});
