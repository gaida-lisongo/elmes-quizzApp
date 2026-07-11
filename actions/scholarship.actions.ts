'use server';

import { getSession } from '@/lib/utils/auth';
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
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
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
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    return await getSessionScholarshipInfo(sessionId);
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Action admin : primer une équipe avec le reste de la Bourse.
 */
export async function awardRemainingScholarshipToTeamAction(
  sessionId: string,
  teamId: string,
  amount?: number,
) {
  return await awardRemainingScholarshipToTeam(sessionId, teamId, amount);
}