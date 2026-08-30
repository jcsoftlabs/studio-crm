import { describe, expect, it } from 'vitest';
import {
  addDaysToDay,
  buildSlots,
  localDayRange,
  localToUtc,
  localWeekdayOf,
  overlaps,
  startOfWeekDay,
  utcToLocalDay,
  utcToLocalMinutes,
  weekDays,
} from '../src/lib/agenda';

const TZ = 'America/Santo_Domingo';

describe('agenda — heure du studio', () => {
  it('convertit 9 h à Santo Domingo en 13 h UTC', () => {
    expect(localToUtc('2026-08-30', 540, TZ).toISOString()).toBe('2026-08-30T13:00:00.000Z');
  });

  it('fait l\'aller-retour sans décaler le jour', () => {
    const utc = localToUtc('2026-08-30', 1290, TZ);
    expect(utcToLocalDay(utc, TZ)).toBe('2026-08-30');
    expect(utcToLocalMinutes(utc, TZ)).toBe(1290);
  });

  it('garde le bon jour local pour un instant tard le soir', () => {
    // 22 h 30 le 30 août à Santo Domingo = 02 h 30 le 31 en UTC.
    const utc = localToUtc('2026-08-30', 1350, TZ);
    expect(utc.toISOString().slice(0, 10)).toBe('2026-08-31');
    expect(utcToLocalDay(utc, TZ)).toBe('2026-08-30');
  });

  it('borne la journée locale sur 24 h', () => {
    const { start, end } = localDayRange('2026-08-30', TZ);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('donne le bon jour de semaine', () => {
    expect(localWeekdayOf('2026-08-30', TZ)).toBe(0); // dimanche
    expect(localWeekdayOf('2026-08-31', TZ)).toBe(1); // lundi
  });
});

describe('agenda — calendrier', () => {
  it('démarre la semaine le lundi', () => {
    expect(startOfWeekDay('2026-08-30')).toBe('2026-08-24');
    expect(startOfWeekDay('2026-08-24')).toBe('2026-08-24');
  });

  it('produit sept jours consécutifs', () => {
    const days = weekDays('2026-08-30');
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-08-24');
    expect(days[6]).toBe('2026-08-30');
  });

  it('franchit les fins de mois', () => {
    expect(addDaysToDay('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysToDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('découpe les créneaux par pas de 15 min', () => {
    expect(buildSlots(540, 600)).toEqual([540, 555, 570, 585]);
  });
});

describe('agenda — chevauchement', () => {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 7, 30, h, m));

  it('détecte un vrai chevauchement', () => {
    expect(overlaps(at(9), at(10), at(9, 30), at(10, 30))).toBe(true);
  });

  it('laisse deux rendez-vous se toucher bout à bout', () => {
    expect(overlaps(at(9), at(10), at(10), at(11))).toBe(false);
  });

  it('détecte un rendez-vous entièrement contenu dans un autre', () => {
    expect(overlaps(at(9), at(12), at(10), at(11))).toBe(true);
  });
});
