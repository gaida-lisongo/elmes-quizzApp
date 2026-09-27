'use server';

import { guardAdmin, guardStaff } from '@/lib/utils/guards';
import { isValidObjectId } from '@/lib/utils/security';
import {
  recomputeCompetitionScholarship,
  getSessionScholarshipInfo,
  awardRemainingScholarshipToTeam,
} from '@/lib/utils/scholarship.service';

/**
 * Recalcule la Bourse d'une session de compétition.
 * Accessible au staff (ADMIN/MOD).
 */
export async function recomputeScholarshipAction(sessionId: string) {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(sessionId)) return { success: false, error: 'Session introuvable' };
    return await recomputeCompetitionScholarship(sessionId);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les infos de Bourse d'une session (staff).
 */
export async function getSessionScholarshipInfoAction(sessionId: string) {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(sessionId)) return { success: false, error: 'Session introuvable' };
    return await getSessionScholarshipInfo(sessionId);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Action admin : primer une équipe avec tout ou partie du reste de la Bourse (EX-PAY-06).
 * Réservée à l'ADMIN ; l'opération est transactionnelle.
 */
export async function awardRemainingScholarshipToTeamAction(
  sessionId: string,
  teamId: string,
  amount?: number,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    return await awardRemainingScholarshipToTeam(sessionId, teamId, amount);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
