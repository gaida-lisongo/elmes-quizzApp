import crypto from 'crypto';

// Module sans accès base de données : utilisable par proxy.ts comme par les actions.

export const COOKIE_NAME = 'genie_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours
export const SESSION_MAX_AGE_S = SESSION_TTL_MS / 1000;

/**
 * Secret de signature des jetons. Aucun secret par défaut : si JWT_SECRET est absent,
 * l'application refuse de fonctionner (contrôlé au démarrage dans instrumentation.ts).
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET doit être défini dans les variables d’environnement.');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(payload).digest('hex');
}

/**
 * Jeton de session : userId:role:timestamp:sessionVersion|signature.
 * Le rôle du jeton n'est qu'indicatif : il est toujours relu en base (getSession).
 */
export function generateToken(userId: string, role: string, sessionVersion = 0): string {
  const payload = `${userId}:${role}:${Date.now()}:${sessionVersion}`;
  return `${payload}|${sign(payload)}`;
}

export interface TokenPayload {
  userId: string;
  role: string;
  issuedAt: number;
  sessionVersion: number;
}

/**
 * Vérifie la signature et l'expiration d'un jeton, sans accès à la base.
 * Les anciens jetons à 3 segments (sans version) restent acceptés jusqu'à leur expiration.
 */
export function verifyToken(token: string | undefined | null): TokenPayload | null {
  try {
    if (!token) return null;
    const parts = token.split('|');
    if (parts.length !== 2) return null;

    const [payload, incomingSignature] = parts;
    const [userId, role, timestamp, version] = payload.split(':');
    if (!userId || !role || !timestamp) return null;

    const expectedSignature = sign(payload);
    if (expectedSignature.length !== incomingSignature.length) return null;
    const valid = crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(incomingSignature));
    if (!valid) return null;

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_TTL_MS || issuedAt > Date.now() + 60_000) {
      return null;
    }

    return { userId, role, issuedAt, sessionVersion: Number(version || 0) || 0 };
  } catch {
    return null;
  }
}
