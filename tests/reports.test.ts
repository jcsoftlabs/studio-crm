import { describe, expect, it } from 'vitest';
import { AppointmentStatus, InvoiceStatus } from '@prisma/client';
import {
  averageTicketCents,
  byEmployee,
  byProduct,
  byService,
  noShowRateBp,
  occupancyRateBp,
  productMarginCents,
  revenueCents,
  toCsv,
} from '../src/lib/reports';

const invoice = (subtotalCents: number, status: InvoiceStatus = InvoiceStatus.ISSUED) => ({
  status,
  issuedAt: new Date('2026-08-24T14:00:00Z'),
  subtotalCents,
  totalCents: Math.round(subtotalCents * 1.18),
});

const line = (over: Partial<Parameters<typeof byService>[0][number]> = {}) => ({
  serviceId: null,
  productId: null,
  employeeId: null,
  description: 'x',
  quantity: 1,
  totalCents: 0,
  costCents: 0,
  ...over,
});

describe('chiffre d\'affaires', () => {
  it('exclut les factures annulées', () => {
    const rows = [invoice(100000), invoice(50000, InvoiceStatus.VOIDED)];
    expect(revenueCents(rows)).toBe(100000);
  });

  it('calcule le panier moyen hors ITBIS', () => {
    expect(averageTicketCents([invoice(100000), invoice(50000)])).toBe(75000);
  });

  it('renvoie zéro sans facture', () => {
    expect(averageTicketCents([])).toBe(0);
    expect(averageTicketCents([invoice(100000, InvoiceStatus.VOIDED)])).toBe(0);
  });
});

describe('regroupements', () => {
  it('agrège par service et trie par montant', () => {
    const rows = byService([
      line({ serviceId: 's1', description: 'Manucure', totalCents: 80000 }),
      line({ serviceId: 's2', description: 'Coupe', totalCents: 140000 }),
      line({ serviceId: 's1', description: 'Manucure', totalCents: 80000 }),
    ]);
    // s1 est passé deux fois : 160 000 devant les 140 000 de s2.
    expect(rows[0]).toMatchObject({ key: 's1', totalCents: 160000, count: 2 });
    expect(rows[1]).toMatchObject({ key: 's2', totalCents: 140000, count: 1 });
  });

  it('ignore les lignes sans clé', () => {
    expect(byProduct([line({ totalCents: 5000 })])).toEqual([]);
  });

  it('nomme les employées', () => {
    const rows = byEmployee(
      [line({ employeeId: 'e1', totalCents: 1000 })],
      new Map([['e1', 'Yamilet']]),
    );
    expect(rows[0].label).toBe('Yamilet');
  });

  it('calcule la marge produits en tenant compte des quantités', () => {
    expect(
      productMarginCents([line({ productId: 'p1', quantity: 3, totalCents: 135000, costCents: 18000 })]),
    ).toBe(81000);
  });
});

describe('taux', () => {
  const appt = (status: AppointmentStatus, minutes = 60) => ({ status, minutes });

  it('exclut les annulations du taux de no-show', () => {
    const rows = [
      appt(AppointmentStatus.DONE),
      appt(AppointmentStatus.NO_SHOW),
      appt(AppointmentStatus.CANCELLED),
    ];
    expect(noShowRateBp(rows)).toBe(5000);
  });

  it('renvoie zéro sans rendez-vous', () => {
    expect(noShowRateBp([])).toBe(0);
    expect(occupancyRateBp([], 480)).toBe(0);
  });

  it('calcule l\'occupation sur les minutes ouvrables', () => {
    expect(occupancyRateBp([appt(AppointmentStatus.DONE, 240)], 480)).toBe(5000);
  });

  it('ne compte pas le temps des rendez-vous annulés', () => {
    expect(
      occupancyRateBp([appt(AppointmentStatus.DONE, 240), appt(AppointmentStatus.CANCELLED, 240)], 480),
    ).toBe(5000);
  });

  it('plafonne à 100 % en cas de surbooking forcé', () => {
    expect(occupancyRateBp([appt(AppointmentStatus.DONE, 600)], 480)).toBe(10000);
  });
});

describe('export CSV', () => {
  it('met un BOM et sépare par point-virgule pour Excel', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('a;b');
  });

  it('échappe les guillemets et les séparateurs', () => {
    expect(toCsv(['a'], [['Peña; "reine"']])).toContain('"Peña; ""reine"""');
  });
});
