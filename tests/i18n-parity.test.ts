import { describe, expect, it } from 'vitest';
import es from '../messages/es.json';
import fr from '../messages/fr.json';

function flatten(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('parité des clés i18n', () => {
  const esKeys = flatten(es).sort();
  const frKeys = flatten(fr).sort();

  it('aucune clé manquante en français', () => {
    expect(esKeys.filter((k) => !frKeys.includes(k))).toEqual([]);
  });

  it('aucune clé en trop en français', () => {
    expect(frKeys.filter((k) => !esKeys.includes(k))).toEqual([]);
  });

  it('aucune valeur vide', () => {
    const empty = (obj: unknown, prefix = ''): string[] => {
      if (typeof obj === 'string') return obj.trim() === '' ? [prefix] : [];
      if (obj && typeof obj === 'object') {
        return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
          empty(v, prefix ? `${prefix}.${k}` : k),
        );
      }
      return [];
    };
    expect(empty(es)).toEqual([]);
    expect(empty(fr)).toEqual([]);
  });
});
