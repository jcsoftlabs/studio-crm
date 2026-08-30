import { describe, expect, it } from 'vitest';
import { computeItbisCents, parseMoneyToCents, parseRateToBp } from '../src/lib/money';

describe('money', () => {
  it('ITBIS 18 % reste en entiers', () => {
    expect(computeItbisCents(100000, 1800)).toBe(18000);
    expect(computeItbisCents(12345, 1800)).toBe(2222);
  });

  it('parse les montants saisis', () => {
    expect(parseMoneyToCents('1,250.50')).toBe(125050);
    expect(parseMoneyToCents('RD$ 800')).toBe(80000);
    expect(parseMoneyToCents('abc')).toBeNull();
  });

  it('convertit un pourcentage en points de base', () => {
    expect(parseRateToBp('18')).toBe(1800);
    expect(parseRateToBp('12,5')).toBe(1250);
  });
});
