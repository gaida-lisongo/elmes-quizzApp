import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import connectToDb from './db';
import User from '../models/User';
import { COOKIE_NAME, SESSION_MAX_AGE_S, generateToken, verifyToken } from './token';

export { COOKIE_NAME, SESSION_MAX_AGE_S, generateToken, verifyToken, getJwtSecret } from './token';

export interface Session {
  userId: string;
  role: string;
}

export async function setSessionCookie(userId: string, role: string, sessionVersion = 0) {
  (await cookies()).set(COOKIE_NAME, generateToken(userId, role, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_S,
    path: '/',
  });
}

/**
 * Récupère la session depuis le cookie 'genie_session'.
 * - signature et expiration (7 jours) vérifiées côté serveur ;
 * - rôle et version de session relus en base : un changement de rôle ou de mot de passe
 *   révoque les jetons existants dès la requête suivante.
 * Mis en cache pour la durée de la requête.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const cookieStore = await cookies();
    const token = verifyToken(cookieStore.get(COOKIE_NAME)?.value);
    if (!token) return null;

    await connectToDb();
    const user = await User.findById(token.userId).select('role sessionVersion').lean();
    if (!user) return null;
    if ((user.sessionVersion ?? 0) !== token.sessionVersion) return null;

    return { userId: String(user._id), role: user.role };
  } catch {
    return null;
  }
});

/**
 * Vérifie que l'utilisateur possède au moins un des rôles requis.
 * Si roles est vide, vérifie simplement qu'il est connecté.
 */
export function hasRole(session: Session | null, roles?: string[]): boolean {
  if (!session) return false;
  if (!roles || roles.length === 0) return true;
  return roles.includes(session.role);
}
