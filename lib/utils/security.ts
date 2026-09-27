import mongoose from 'mongoose';

/** Échappe une saisie pour l'utiliser dans une expression régulière (anti-injection et ReDoS). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex insensible à la casse construite à partir d'une saisie utilisateur échappée et tronquée. */
export function safeSearchRegex(value: unknown, maxLength = 50): RegExp {
  return new RegExp(escapeRegex(String(value ?? '').trim().slice(0, maxLength)), 'i');
}

/** Regex d'égalité exacte (insensible à la casse) sur une saisie échappée. */
export function exactMatchRegex(value: unknown, maxLength = 100): RegExp {
  return new RegExp(`^${escapeRegex(String(value ?? '').trim().slice(0, maxLength))}$`, 'i');
}

/** Échappe une chaîne avant interpolation dans du HTML (e-mails). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Identifiant Mongo valide, en forçant une chaîne (bloque les objets de type { $ne: null }). */
export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value) && /^[a-f0-9]{24}$/i.test(value);
}

/** Masque un numéro de téléphone pour les logs : +243******123. */
export function maskPhone(phone: unknown): string {
  const text = String(phone ?? '');
  if (text.length <= 4) return '***';
  return `${text.slice(0, 4)}${'*'.repeat(Math.max(0, text.length - 7))}${text.slice(-3)}`;
}
