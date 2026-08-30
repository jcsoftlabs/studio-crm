import { describe, expect, it } from 'vitest';
import { daysUntil, formatNcf, isLow, remaining } from '../src/lib/ncf';

describe('NCF', () => {
  it('formate sur 8 chiffres après le préfixe', () => {
    expect(formatNcf('B02', 1)).toBe('B0200000001');
    expect(formatNcf('B02', 12345678)).toBe('B0212345678');
  });

  it('compte les numéros restants', () => {
    expect(remaining({ currentNumber: 940, maxNumber: 1000 })).toBe(60);
    expect(remaining({ currentNumber: 1000, maxNumber: 1000 })).toBe(0);
    expect(remaining({ currentNumber: 1200, maxNumber: 1000 })).toBe(0);
  });

  it('alerte sous le seuil de numéros restants', () => {
    const thresholds = { lowThreshold: 50, expiryWarningDays: 30 };
    expect(isLow({ currentNumber: 940, maxNumber: 1000, expiresAt: null }, thresholds)).toBe(false);
    expect(isLow({ currentNumber: 960, maxNumber: 1000, expiresAt: null }, thresholds)).toBe(true);
  });

  it('alerte à l\'approche de l\'expiration', () => {
    const now = new Date('2026-08-30T12:00:00Z');
    const thresholds = { lowThreshold: 50, expiryWarningDays: 30 };
    const soon = new Date('2026-09-10T12:00:00Z');
    const later = new Date('2026-12-01T12:00:00Z');
    expect(isLow({ currentNumber: 1, maxNumber: 1000, expiresAt: soon }, thresholds, now)).toBe(true);
    expect(isLow({ currentNumber: 1, maxNumber: 1000, expiresAt: later }, thresholds, now)).toBe(false);
  });

  it('compte les jours avant expiration', () => {
    const now = new Date('2026-08-30T12:00:00Z');
    expect(daysUntil(new Date('2026-09-06T12:00:00Z'), now)).toBe(7);
    expect(daysUntil(null, now)).toBeNull();
  });
});
