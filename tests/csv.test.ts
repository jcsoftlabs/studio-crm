import { describe, expect, it } from 'vitest';
import { detectDelimiter, guessMapping, parseCsv, parseFlexibleDate } from '../src/lib/csv';

describe('csv', () => {
  it('détecte le point-virgule des exports Excel', () => {
    expect(detectDelimiter('Nombre;Telefono\nAna;809')).toBe(';');
  });

  it('retire le BOM et gère les CRLF', () => {
    const table = parseCsv('﻿Nombre,Telefono\r\nAna,809-555-1234\r\n');
    expect(table.headers).toEqual(['Nombre', 'Telefono']);
    expect(table.rows).toEqual([['Ana', '809-555-1234']]);
  });

  it('gère les guillemets et les virgules internes', () => {
    const table = parseCsv('Nombre,Nota\n"Peña, Ana","Prefiere ""nude"""');
    expect(table.rows[0]).toEqual(['Peña, Ana', 'Prefiere "nude"']);
  });

  it('complète les lignes plus courtes que l\'en-tête', () => {
    const table = parseCsv('a,b,c\n1,2');
    expect(table.rows[0]).toEqual(['1', '2', '']);
  });

  it('devine les colonnes ES et FR', () => {
    const mapping = guessMapping(['Nombre', 'Apellidos', 'Teléfono', 'Correo']);
    expect(mapping.firstName).toBe(0);
    expect(mapping.lastName).toBe(1);
    expect(mapping.phone).toBe(2);
    expect(mapping.email).toBe(3);
  });

  it('reconnaît la colonne WhatsApp comme téléphone', () => {
    expect(guessMapping(['Prénom', 'WhatsApp']).phone).toBe(1);
  });

  it('lit les dates ISO et JJ/MM/AAAA', () => {
    expect(parseFlexibleDate('1990-03-07')?.toISOString().slice(0, 10)).toBe('1990-03-07');
    // Jour d'abord : convention RD et FR.
    expect(parseFlexibleDate('07/03/1990')?.toISOString().slice(0, 10)).toBe('1990-03-07');
    // Ambigu résolu en faveur du jour quand le premier nombre dépasse 12.
    expect(parseFlexibleDate('03/07/1990')?.toISOString().slice(0, 10)).toBe('1990-07-03');
    expect(parseFlexibleDate('25/12/1990')?.toISOString().slice(0, 10)).toBe('1990-12-25');
    expect(parseFlexibleDate('pas une date')).toBeNull();
    expect(parseFlexibleDate('31/02/1990')).toBeNull();
  });
});
