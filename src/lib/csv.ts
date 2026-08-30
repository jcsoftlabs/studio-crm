/**
 * Parseur tolérant : le fichier vient d'un export de contacts ou d'un Excel bricolé.
 * Gère le BOM, les séparateurs `,` `;` et tabulation, les guillemets et les CRLF.
 */

export type CsvTable = { headers: string[]; rows: string[][] };

export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(input: string, delimiter?: string): CsvTable {
  const text = input.replace(/^\ufeff/, '');
  const sep = delimiter ?? detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const cleaned = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (cleaned.length === 0) return { headers: [], rows: [] };

  const headers = cleaned[0].map((h) => h.trim());
  const width = headers.length;
  const body = cleaned.slice(1).map((r) => {
    const padded = r.slice(0, width);
    while (padded.length < width) padded.push('');
    return padded.map((cell) => cell.trim());
  });

  return { headers, rows: body };
}

const HEADER_HINTS: Record<string, string[]> = {
  firstName: ['nombre', 'prenom', 'prénom', 'first name', 'firstname', 'given name'],
  lastName: ['apellido', 'apellidos', 'nom', 'last name', 'lastname', 'family name', 'surname'],
  phone: ['telefono', 'teléfono', 'celular', 'movil', 'móvil', 'whatsapp', 'telephone', 'téléphone', 'phone', 'mobile', 'numero', 'número'],
  email: ['correo', 'email', 'e-mail', 'mail'],
  birthDate: ['cumpleanos', 'cumpleaños', 'nacimiento', 'anniversaire', 'naissance', 'birthday', 'birth date'],
  notes: ['nota', 'notas', 'note', 'notes', 'observacion', 'observación', 'commentaire'],
};

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Propose un mapping, que l'utilisatrice peut corriger avant l'import. */
export function guessMapping(headers: string[]): Record<string, number | null> {
  const mapping: Record<string, number | null> = {
    firstName: null,
    lastName: null,
    phone: null,
    email: null,
    birthDate: null,
    notes: null,
  };

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    for (const [field, hints] of Object.entries(HEADER_HINTS)) {
      if (mapping[field] !== null) continue;
      if (hints.some((hint) => normalized === hint || normalized.includes(hint))) {
        mapping[field] = index;
        return;
      }
    }
  });

  return mapping;
}

/** Accepte JJ/MM/AAAA, MM/JJ/AAAA ambigu résolu en faveur du jour, et AAAA-MM-JJ. */
export function parseFlexibleDate(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(trimmed);
  if (slashed) {
    const [, a, b, y] = slashed;
    let year = Number(y);
    if (year < 100) year += year > 30 ? 1900 : 2000;
    let day = Number(a);
    let month = Number(b);
    if (day > 12 && month <= 12) {
      // déjà JJ/MM
    } else if (month > 12 && day <= 12) {
      [day, month] = [month, day];
    }
    return buildDate(year, month, day);
  }

  return null;
}

function buildDate(year: number, month: number, day: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}
