import { cookies } from 'next/headers';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'genie_quiz_secret_key_ultra_secure_2026';
const COOKIE_NAME = 'genie_session';

export interface Session {
  userId: string;
  role: string;
}

/**
 * Récupère et valide la session depuis le cookie 'genie_session'.
 * Retourne l'objet session { userId, role } ou null si absent/invalide.
 */
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const parts = token.split('|');
    if (parts.length !== 2) return null;

    const [payload, incomingSignature] = parts;
    const [userId, role, timestamp] = payload.split(':');

    if (!userId || !role || !timestamp) return null;

    // Recalculer la signature HMAC-SHA256 côté Node.js (synchrone)
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(payload)
      .digest('hex');

    // Comparaison en temps constant pour éviter les attaques temporelles
    if (expectedSignature.length !== incomingSignature.length) return null;

    const valid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(incomingSignature)
    );

    if (!valid) return null;

    return { userId, role };
  } catch {
    return null;
  }
}

/**
 * Vérifie que l'utilisateur possède au moins un des rôles requis.
 * Si roles est vide, vérifie simplement qu'il est connecté.
 */
export function hasRole(session: Session | null, roles?: string[]): boolean {
  if (!session) return false;
  if (!roles || roles.length === 0) return true;
  return roles.includes(session.role);
}
