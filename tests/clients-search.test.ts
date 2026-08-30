import { describe, expect, it } from 'vitest';
import { buildSearchName, digitsOnly, displayName, normalizeText, searchTerms } from '../src/lib/clients';

describe('recherche clientes', () => {
  it('ignore les accents et la casse', () => {
    expect(normalizeText('Yokasta  PEÑA')).toBe('yokasta pena');
    expect(buildSearchName('Anaïs', 'Jiménez')).toBe('anais jimenez');
  });

  it('ne garde que les chiffres du téléphone', () => {
    expect(digitsOnly('+1 (809) 555-1234')).toBe('18095551234');
  });

  it('sépare le terme nom et le terme téléphone', () => {
    expect(searchTerms('809-555')).toEqual({ name: '809-555', phone: '809555' });
    expect(searchTerms('  Peña ')).toEqual({ name: 'pena', phone: '' });
  });

  it('affiche un nom propre même sans nom de famille', () => {
    expect(displayName({ firstName: 'Ana', lastName: '' })).toBe('Ana');
  });
});
