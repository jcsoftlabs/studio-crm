import { describe, expect, it } from 'vitest';
import {
  birthdaysThisMonth,
  inactiveClients,
  selectSegment,
  topClients,
  type SegmentClient,
} from '../src/lib/segments';

const NOW = new Date('2026-08-30T12:00:00Z');

const client = (over: Partial<SegmentClient> & { id: string }): SegmentClient => ({
  firstName: 'X',
  lastName: 'Y',
  phone: '809-000-0000',
  birthDate: null,
  lastVisitAt: null,
  spentCents: 0,
  visits: 0,
  ...over,
});

describe('clientes inactives', () => {
  it('retient celles dont la dernière visite dépasse le délai', () => {
    const rows = inactiveClients(
      [
        client({ id: 'a', lastVisitAt: new Date('2026-06-01T00:00:00Z') }),
        client({ id: 'b', lastVisitAt: new Date('2026-08-20T00:00:00Z') }),
      ],
      60,
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(['a']);
  });

  it("ignore celles qui ne sont jamais venues : ce sont des fiches, pas des pertes", () => {
    expect(inactiveClients([client({ id: 'a' })], 60, NOW)).toEqual([]);
  });

  it('trie de la plus ancienne à la plus récente', () => {
    const rows = inactiveClients(
      [
        client({ id: 'recent', lastVisitAt: new Date('2026-05-01T00:00:00Z') }),
        client({ id: 'ancien', lastVisitAt: new Date('2026-01-01T00:00:00Z') }),
      ],
      60,
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(['ancien', 'recent']);
  });
});

describe('anniversaires du mois', () => {
  it("retient le mois quelle que soit l'année de naissance", () => {
    const rows = birthdaysThisMonth(
      [
        client({ id: 'aout', birthDate: new Date('1990-08-14T00:00:00Z') }),
        client({ id: 'mai', birthDate: new Date('1990-05-14T00:00:00Z') }),
      ],
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(['aout']);
  });

  it('trie par jour du mois', () => {
    const rows = birthdaysThisMonth(
      [
        client({ id: 'le25', birthDate: new Date('1988-08-25T00:00:00Z') }),
        client({ id: 'le03', birthDate: new Date('1995-08-03T00:00:00Z') }),
      ],
      NOW,
    );
    expect(rows.map((r) => r.id)).toEqual(['le03', 'le25']);
  });

  it('ignore les fiches sans date de naissance', () => {
    expect(birthdaysThisMonth([client({ id: 'a' })], NOW)).toEqual([]);
  });
});

describe('top clientes', () => {
  it('classe par montant dépensé et écarte celles qui n\'ont rien dépensé', () => {
    const rows = topClients([
      client({ id: 'petite', spentCents: 5000 }),
      client({ id: 'grosse', spentCents: 900000 }),
      client({ id: 'aucune', spentCents: 0 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['grosse', 'petite']);
  });

  it('limite la liste', () => {
    const many = Array.from({ length: 30 }, (_, i) => client({ id: String(i), spentCents: i + 1 }));
    expect(topClients(many, 5)).toHaveLength(5);
  });
});

describe('sélecteur de segment', () => {
  const rows = [
    client({ id: 'a', lastVisitAt: new Date('2026-01-01T00:00:00Z'), spentCents: 1000 }),
    client({ id: 'b', birthDate: new Date('1990-08-10T00:00:00Z') }),
  ];

  it('route vers le bon segment', () => {
    expect(selectSegment('inactive', rows, { inactiveAfterDays: 60, now: NOW }).map((r) => r.id)).toEqual(['a']);
    expect(selectSegment('birthdays', rows, { inactiveAfterDays: 60, now: NOW }).map((r) => r.id)).toEqual(['b']);
    expect(selectSegment('top', rows, { inactiveAfterDays: 60, now: NOW }).map((r) => r.id)).toEqual(['a']);
  });
});
