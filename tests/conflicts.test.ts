import { describe, expect, it } from 'vitest';
import { hasBlocking, isOutsideSchedule, type Conflict } from '../src/lib/conflicts';

const openDay = { closed: false, openMinute: 540, closeMinute: 1080 };

describe('horaires de travail', () => {
  it('accepte un créneau entièrement dans la journée', () => {
    expect(isOutsideSchedule(openDay, 600, 660)).toBe(false);
  });

  it('accepte les bords exacts', () => {
    expect(isOutsideSchedule(openDay, 540, 1080)).toBe(false);
  });

  it('refuse un début avant l\'ouverture', () => {
    expect(isOutsideSchedule(openDay, 480, 600)).toBe(true);
  });

  it('refuse une fin après la fermeture', () => {
    expect(isOutsideSchedule(openDay, 1020, 1140)).toBe(true);
  });

  it('refuse un jour de repos', () => {
    expect(isOutsideSchedule({ ...openDay, closed: true }, 600, 660)).toBe(true);
  });

  it('refuse une employée sans horaire pour ce jour', () => {
    expect(isOutsideSchedule(undefined, 600, 660)).toBe(true);
  });

  it('refuse un débordement sur le lendemain', () => {
    expect(isOutsideSchedule({ closed: false, openMinute: 0, closeMinute: 1500 }, 1400, 1460)).toBe(true);
  });
});

describe('blocage', () => {
  const overlap: Conflict = { kind: 'OVERLAP', blocking: true };
  const outside: Conflict = { kind: 'OUTSIDE_HOURS', blocking: false };
  const timeOff: Conflict = { kind: 'TIME_OFF', blocking: false };

  it('bloque sur un chevauchement', () => {
    expect(hasBlocking([outside, overlap])).toBe(true);
  });

  it('ne bloque pas hors horaires ni pendant un congé', () => {
    expect(hasBlocking([outside, timeOff])).toBe(false);
  });

  it('ne bloque rien quand il n\'y a aucun conflit', () => {
    expect(hasBlocking([])).toBe(false);
  });
});
