import 'server-only';
import connectToDb from './db';
import { getSession, hasRole, type Session } from './auth';
import Player, { type IPlayer } from '../models/Player';
import Agent from '../models/Agent';

/**
 * Gardes d'accès centralisées (EX-SEC-01).
 * - le rôle est relu en base par getSession() à chaque requête ;
 * - le joueur est toujours résolu depuis la session, jamais depuis un argument client.
 *
 * Usage type dans une action :
 *   const guard = await guardRole(['ADMIN']);
 *   if (!guard.ok) return { success: false, error: guard.error };
 */

export type Role = 'PLAYER' | 'MOD' | 'ADMIN';

/** Permissions attribuables aux agents MOD (l'ADMIN les possède toutes). */
export const AGENT_PERMISSIONS = ['HOME', 'PARCOURS', 'COMPETITIONS', 'ABOUT', 'EQUIPES', 'FINANCE'] as const;
export type AgentPermission = (typeof AGENT_PERMISSIONS)[number];

export const UNAUTHORIZED = 'Non autorisé';

export class AuthError extends Error {}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError('Non connecté.');
  return session;
}

export async function requireRole(roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!hasRole(session, roles)) throw new AuthError(UNAUTHORIZED);
  return session;
}

/**
 * ADMIN, ou MOD disposant de la permission demandée (Agent.permissions).
 */
export async function requirePermission(permission: AgentPermission): Promise<Session> {
  const session = await requireRole(['ADMIN', 'MOD']);
  if (session.role === 'ADMIN') return session;

  await connectToDb();
  const agent = await Agent.findOne({ userId: session.userId }).select('permissions').lean();
  if (!agent?.permissions?.includes(permission)) {
    throw new AuthError('Permission manquante pour cette action.');
  }
  return session;
}

export async function hasPermission(session: Session, permission: AgentPermission): Promise<boolean> {
  if (session.role === 'ADMIN') return true;
  if (session.role !== 'MOD') return false;
  await connectToDb();
  const agent = await Agent.findOne({ userId: session.userId }).select('permissions').lean();
  return Boolean(agent?.permissions?.includes(permission));
}

/** Joueur de la session : à utiliser à la place de tout playerId / captainId reçu du client. */
export async function requirePlayer(): Promise<{ session: Session; player: IPlayer }> {
  const session = await requireRole(['PLAYER']);
  await connectToDb();
  const player = await Player.findOne({ userId: session.userId });
  if (!player) throw new AuthError('Profil joueur introuvable.');
  return { session, player };
}

// ── Variantes sans exception, au format { success, error } déjà utilisé par les actions ──

type GuardResult<T> = ({ ok: true } & T) | { ok: false; error: string };

async function wrap<T extends object>(fn: () => Promise<T>): Promise<GuardResult<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: error.message };
    throw error;
  }
}

export const guardSession = () => wrap(async () => ({ session: await requireSession() }));
export const guardRole = (roles: Role[]) => wrap(async () => ({ session: await requireRole(roles) }));
export const guardStaff = () => guardRole(['ADMIN', 'MOD']);
export const guardAdmin = () => guardRole(['ADMIN']);
export const guardPermission = (permission: AgentPermission) =>
  wrap(async () => ({ session: await requirePermission(permission) }));
export const guardPlayer = () => wrap(requirePlayer);
