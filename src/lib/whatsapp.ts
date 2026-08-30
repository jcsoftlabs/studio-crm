/**
 * Pas de WhatsApp Cloud API (aucun numéro vérifié chez Meta) : on ouvre WhatsApp
 * avec un message pré-rempli via wa.me, l'envoi reste manuel. Voir §7 bis du plan.
 */

const DO_AREA_CODES = ['809', '829', '849'];

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10 && DO_AREA_CODES.includes(digits.slice(0, 3))) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  if (digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

export function buildWhatsAppLink(phone: string, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
