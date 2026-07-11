'use server';

import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';
import Partie from '@/lib/models/Partie';
import ScholarshipMovement from '@/lib/models/ScholarshipMovement';
import { getSession } from '@/lib/utils/auth';
import { sendMail } from '@/lib/utils/mail';

const { Enrollement, Session } = EnrollementModule;

// ── CONSTANTES ─────────────────────────────────────────────────────

const DEFAULT_PLATFORM_RATE = 0.35;
const DEFAULT_SCHOLARSHIP_RATE = 0.65;
const DEFAULT_GAMES_PER_ENROLLMENT = 250;

// ── UTILITAIRES ────────────────────────────────────────────────────

const floorCDF = (value: number): number => Math.floor(Math.max(0, value));

/**
 * Résout le montant CDF de référence pour un enrôlement.
 * Priorité : enrollment.transactions[].montant si PAID et en CDF,
 * sinon competition.amount, sinon 0.
 */
async function resolveEnrollmentAmountCDF(enrollment: any): Promise<number> {
  // Chercher le montant CDF dans les transactions PAID
  if (enrollment.competitionId?.amount !== undefined) {
    return floorCDF(Number(enrollment.competitionId.amount) || 0);
  }

  // Sinon, prendre le montant de la compétition liée
  if (enrollment.competitionId) {
    const compId = enrollment.competitionId?._id || enrollment.competitionId;
    try {
      const { Competition } = await import('@/lib/models/Competition');
      const competition = await Competition.findById(compId).lean();
      if (competition) {
        return floorCDF(Number(competition.amount) || 0);
      }
    } catch {
      return 0;
    }
  }

  return 0;
}

// ── RECALCUL DE LA BOURSE ─────────────────────────────────────────

/**
 * Recalcule la Bourse d'Excellence Académique pour une session de compétition.
 * Appelé après chaque validation d'enrôlement.
 */
export async function recomputeCompetitionScholarship(sessionId: string): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    await connectToDb();

    const session = await Session.findById(sessionId);
    if (!session) return { success: false, error: 'Session introuvable' };
    if (session.type !== 'competition') return { success: false, error: 'Seules les sessions de compétition ont une Bourse' };

    // Récupérer les enrôlements validés (CONFIRMED)
    const validatedEnrollments = await Enrollement.find({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      competitionId: { $exists: true, $ne: null },
      equipeId: { $exists: true, $ne: null },
      status: 'CONFIRMED',
    })
      .populate('competitionId', 'amount')
      .lean();

    if (validatedEnrollments.length === 0) {
      return { success: false, error: 'Aucun enrôlement validé pour cette session' };
    }

    // Déterminer l'enrollmentFeeCDF depuis le premier enrôlement ou la compétition
    let enrollmentFeeCDF = 0;
    let totalCollectedCDF = 0;
    for (const enrollment of validatedEnrollments as any[]) {
      const amount = await resolveEnrollmentAmountCDF(enrollment);
      if (amount > 0) {
        if (enrollmentFeeCDF <= 0) enrollmentFeeCDF = amount;
        totalCollectedCDF += amount;
      }
    }

    // Si aucun montant trouvé via les transactions, prendre competition.amount
    if (enrollmentFeeCDF <= 0) {
      const comp = (validatedEnrollments[0] as any)?.competitionId;
      enrollmentFeeCDF = Number(comp?.amount || 0);
    }

    // Fallback : si on a un competition.amount sur la session, l'utiliser
    const competitionId = (validatedEnrollments[0] as any)?.competitionId?._id
      || (validatedEnrollments[0] as any)?.competitionId;
    if (enrollmentFeeCDF <= 0 && competitionId) {
      try {
        const { Competition } = await import('@/lib/models/Competition');
        const comp = await Competition.findById(competitionId).lean();
        enrollmentFeeCDF = Number(comp?.amount || 0);
      } catch { /* ignore */ }
    }

    if (enrollmentFeeCDF <= 0) {
      return { success: false, error: 'Impossible de déterminer le montant CDF de référence' };
    }

    if (totalCollectedCDF <= 0 && enrollmentFeeCDF > 0) {
      totalCollectedCDF = validatedEnrollments.length * enrollmentFeeCDF;
    }
    if (totalCollectedCDF <= 0) {
      return { success: false, error: 'Aucun montant CDF valide disponible pour calculer la Bourse' };
    }

    const totalValidatedEnrollments = validatedEnrollments.length;
    const platformRate = session.platformRate ?? DEFAULT_PLATFORM_RATE;
    const scholarshipRate = session.scholarshipRate ?? DEFAULT_SCHOLARSHIP_RATE;
    const gamesPerEnrollment = session.gamesPerEnrollment ?? DEFAULT_GAMES_PER_ENROLLMENT;

    // totalCollectedCDF = somme des montants CDF
    // Nouveaux montants théoriques
    const platformAmountCDF = floorCDF(totalCollectedCDF * platformRate);
    const scholarshipInitialAmountCDF = floorCDF(totalCollectedCDF * scholarshipRate);
    const totalGrantedGames = totalValidatedEnrollments * gamesPerEnrollment;
    const unitRewardPerWonGameCDF = totalGrantedGames > 0
      ? floorCDF(scholarshipInitialAmountCDF / totalGrantedGames)
      : 0;

    // Ne pas écraser scholarshipDistributedAmountCDF
    const alreadyDistributed = session.scholarshipDistributedAmountCDF ?? 0;
    const scholarshipRemainingAmountCDF = Math.max(0, scholarshipInitialAmountCDF - alreadyDistributed);

    // Sauvegarder
    const beforeRemaining = session.scholarshipRemainingAmountCDF ?? 0;

    session.enrollmentFeeCDF = enrollmentFeeCDF;
    session.platformRate = platformRate;
    session.scholarshipRate = scholarshipRate;
    session.gamesPerEnrollment = gamesPerEnrollment;
    session.totalValidatedEnrollments = totalValidatedEnrollments;
    session.totalCollectedCDF = totalCollectedCDF;
    session.platformAmountCDF = platformAmountCDF;
    session.scholarshipInitialAmountCDF = scholarshipInitialAmountCDF;
    session.scholarshipDistributedAmountCDF = alreadyDistributed;
    session.scholarshipRemainingAmountCDF = scholarshipRemainingAmountCDF;
    session.totalGrantedGames = totalGrantedGames;
    session.unitRewardPerWonGameCDF = unitRewardPerWonGameCDF;
    session.lastScholarshipComputedAt = new Date();
    await session.save();

    // Enregistrer le mouvement
    await ScholarshipMovement.create({
      sessionId: session._id,
      type: 'scholarship_recompute',
      amountCDF: scholarshipInitialAmountCDF,
      beforeRemainingCDF: beforeRemaining,
      afterRemainingCDF: scholarshipRemainingAmountCDF,
      createdBy: 'SYSTEM',
      note: `Recalcul après ${totalValidatedEnrollments} enrôlement(s) validé(s)`,
    });

    return {
      success: true,
      data: {
        enrollmentFeeCDF,
        totalValidatedEnrollments,
        totalCollectedCDF,
        platformAmountCDF,
        scholarshipInitialAmountCDF,
        scholarshipDistributedAmountCDF: alreadyDistributed,
        scholarshipRemainingAmountCDF,
        totalGrantedGames,
        unitRewardPerWonGameCDF,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── CRÉDIT PAR PARTIE GAGNÉE ──────────────────────────────────────

/**
 * Crédite la Bourse à une équipe lorsqu'elle gagne une partie.
 * Appelé depuis terminerPartieAction.
 */
export async function creditScholarshipForWonGame(
  partieId: string,
  enrollmentId: string,
): Promise<{ success: boolean; error?: string; rewardCDF?: number }> {
  try {
    await connectToDb();

    const partie = await Partie.findById(partieId).lean();
    if (!partie) return { success: false, error: 'Partie introuvable' };
    if (partie.scholarshipCredited) {
      return { success: false, error: 'Cette partie a déjà été récompensée' };
    }
    if (partie.status !== 'TERMINE') {
      return { success: false, error: 'La partie doit être terminée pour créditer la Bourse' };
    }

    // Vérifier que c'est une partie VIP (competition)
    if (partie.mode !== 'VIP' || partie.gameSource !== 'competition') {
      return { success: false, error: 'Seules les parties de compétition (VIP) sont éligibles' };
    }

    // Vérifier que toutes les réponses sont correctes (partie gagnée)
    const allCorrect = partie.reponses?.every((r: any) => r.estCorrecte) ?? false;
    if (!allCorrect) {
      return { success: false, error: 'La partie n\'est pas entièrement gagnée' };
    }

    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('sessionId')
      .populate('equipeId')
      .lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };
    if (enrollment.status !== 'CONFIRMED') {
      return { success: false, error: 'Enrôlement non confirmé' };
    }
    if (!enrollment.equipeId) {
      return { success: false, error: 'Enrôlement sans équipe' };
    }

    const session = enrollment.sessionId as any;
    if (!session) return { success: false, error: 'Session introuvable' };
    if (session.type !== 'competition') {
      return { success: false, error: 'Session de compétition requise' };
    }

    const equipeId = enrollment.equipeId.toString();
    const sessionId = session._id.toString();

    // Vérifier que la session est active
    if (!['ACTIVE', 'COMPLETED'].includes(session.status)) {
      return { success: false, error: 'La session est inactive : la Bourse d\'Excellence AcadÃ©mique disponible a Ã©tÃ© entiÃ¨rement distribuÃ©e ou suspendue par la gestion.' };
    }

    // Vérifier la Bourse restante
    const currentRemaining = session.scholarshipRemainingAmountCDF ?? 0;
    if (currentRemaining <= 0) {
      // Marquer la session comme inactive si Bourse épuisée
      await Session.findByIdAndUpdate(sessionId, {
        status: 'INACTIVE',
        scholarshipFullyDistributedAt: new Date(),
      });
      return { success: false, error: 'La Bourse d\'Excellence Académique est épuisée' };
    }

    // Calculer la récompense
    const unitReward = session.unitRewardPerWonGameCDF ?? 0;
    if (unitReward <= 0) {
      return { success: false, error: 'Valeur unitaire de Bourse non calculÃ©e. Recalculez la Bourse de session.' };
    }
    const rawRewardCDF = unitReward;
    const rewardCDF = Math.min(rawRewardCDF, currentRemaining);

    if (rewardCDF <= 0) {
      return { success: false, error: 'Récompense nulle ou Bourse insuffisante' };
    }

    const beforeRemaining = currentRemaining;
    const afterRemaining = beforeRemaining - rewardCDF;

    // Créditer l'équipe
    const lockedPartie = await Partie.findOneAndUpdate(
      { _id: partieId, scholarshipCredited: { $ne: true }, status: 'TERMINE' },
      { $set: { scholarshipCredited: true } },
      { new: true },
    ).lean();
    if (!lockedPartie) {
      return { success: false, error: 'Cette partie a dÃ©jÃ  Ã©tÃ© rÃ©compensÃ©e' };
    }

    // Mettre à jour la session
    const updatedSession = await Session.findOneAndUpdate(
      { _id: sessionId, scholarshipRemainingAmountCDF: { $gte: rewardCDF } },
      {
      $inc: {
        scholarshipDistributedAmountCDF: rewardCDF,
        scholarshipRemainingAmountCDF: -rewardCDF,
      },
      },
      { new: true },
    ).lean();
    if (!updatedSession) {
      await Partie.findByIdAndUpdate(partieId, { scholarshipCredited: false });
      return { success: false, error: 'Bourse restante insuffisante pour crÃ©diter cette partie' };
    }

    // Marquer la partie comme créditée
    await Equipe.findByIdAndUpdate(equipeId, {
      $inc: { 'metriques.soldeCDF': rewardCDF },
    });

    // Enregistrer le mouvement
    await ScholarshipMovement.create({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      teamId: new mongoose.Types.ObjectId(equipeId),
      enrollmentId: new mongoose.Types.ObjectId(enrollmentId),
      gameId: new mongoose.Types.ObjectId(partieId),
      type: 'reward_per_won_game',
      amountCDF: rewardCDF,
      beforeRemainingCDF: beforeRemaining,
      afterRemainingCDF: afterRemaining,
      createdBy: 'SYSTEM',
      note: `Crédit de ${rewardCDF} FC pour partie gagnée`,
    });

    // Vérifier si la Bourse est épuisée
    if (afterRemaining <= 0) {
      await Session.findByIdAndUpdate(sessionId, {
        status: 'INACTIVE',
        scholarshipFullyDistributedAt: new Date(),
      });
    }

    return { success: true, rewardCDF };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ACTION ADMIN : PRIMER UNE ÉQUIPE ──────────────────────────────

/**
 * Action admin pour attribuer le reste de la Bourse à une équipe.
 */
export async function awardRemainingScholarshipToTeam(
  sessionId: string,
  teamId: string,
  amount?: number,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé. Action réservée aux administrateurs.' };
    }

    await connectToDb();

    const session = await Session.findById(sessionId);
    if (!session) return { success: false, error: 'Session introuvable' };
    if (session.type !== 'competition') {
      return { success: false, error: 'Seules les sessions de compétition ont une Bourse' };
    }

    const remaining = session.scholarshipRemainingAmountCDF ?? 0;
    if (remaining <= 0) {
      return { success: false, error: 'La Bourse restante est déjà épuisée' };
    }

    // Vérifier que l'équipe est enrôlée dans cette session
    const enrollment = await Enrollement.findOne({
      sessionId: new mongoose.Types.ObjectId(sessionId),
      equipeId: new mongoose.Types.ObjectId(teamId),
      competitionId: { $exists: true, $ne: null },
      status: 'CONFIRMED',
    }).lean();

    if (!enrollment) {
      return { success: false, error: 'Cette équipe n\'est pas enrôlée dans cette session' };
    }

    // Montant à attribuer
    const awardAmount = amount !== undefined ? floorCDF(Number(amount)) : remaining;

    if (awardAmount <= 0) {
      return { success: false, error: 'Montant invalide' };
    }
    if (awardAmount > remaining) {
      return { success: false, error: 'Le montant demandÃ© dÃ©passe la Bourse restante' };
    }

    const beforeRemaining = remaining;
    const afterRemaining = remaining - awardAmount;

    // Créditer l'équipe
    await Equipe.findByIdAndUpdate(teamId, {
      $inc: { 'metriques.soldeCDF': awardAmount },
    });

    // Mettre à jour la session
    await Session.findByIdAndUpdate(sessionId, {
      $inc: {
        scholarshipDistributedAmountCDF: awardAmount,
        scholarshipRemainingAmountCDF: -awardAmount,
      },
    });

    // Marquer la session inactive si Bourse épuisée
    if (afterRemaining <= 0) {
      await Session.findByIdAndUpdate(sessionId, {
        status: 'INACTIVE',
        scholarshipFullyDistributedAt: new Date(),
      });
    }

    // Enregistrer le mouvement
    await ScholarshipMovement.create({
      sessionId: session._id,
      teamId: new mongoose.Types.ObjectId(teamId),
      enrollmentId: enrollment._id,
      type: 'scholarship_admin_award',
      amountCDF: awardAmount,
      beforeRemainingCDF: beforeRemaining,
      afterRemainingCDF: afterRemaining,
      createdBy: 'ADMIN',
      note: amount !== undefined && amount > 0
        ? `Prime de clôture de session : ${awardAmount} FC attribués à l'équipe`
        : `Prime complémentaire d'excellence : total restant de ${awardAmount} FC attribué à l'équipe`,
    });

    return {
      success: true,
      data: {
        awardAmount,
        beforeRemaining,
        afterRemaining,
        teamId,
        scholarshipFullyDistributed: afterRemaining <= 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── GETTERS POUR L'AFFICHAGE ──────────────────────────────────────

/**
 * Récupère les infos de Bourse pour une session (affichage joueur/admin).
 */
export async function getSessionScholarshipInfo(sessionId: string) {
  try {
    await connectToDb();
    const session = await Session.findById(sessionId).lean();
    if (!session) return { success: false, error: 'Session introuvable' };

    const movements = await ScholarshipMovement.find({ sessionId: new mongoose.Types.ObjectId(sessionId) })
      .populate('teamId', 'designation')
      .populate('gameId', 'note status')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return {
      success: true,
      data: {
        enrollmentFeeCDF: session.enrollmentFeeCDF ?? 0,
        totalValidatedEnrollments: session.totalValidatedEnrollments ?? 0,
        totalCollectedCDF: session.totalCollectedCDF ?? 0,
        platformAmountCDF: session.platformAmountCDF ?? 0,
        scholarshipInitialAmountCDF: session.scholarshipInitialAmountCDF ?? 0,
        scholarshipDistributedAmountCDF: session.scholarshipDistributedAmountCDF ?? 0,
        scholarshipRemainingAmountCDF: session.scholarshipRemainingAmountCDF ?? 0,
        totalGrantedGames: session.totalGrantedGames ?? 0,
        unitRewardPerWonGameCDF: session.unitRewardPerWonGameCDF ?? 0,
        gamesPerEnrollment: session.gamesPerEnrollment ?? DEFAULT_GAMES_PER_ENROLLMENT,
        lastScholarshipComputedAt: session.lastScholarshipComputedAt,
        scholarshipFullyDistributedAt: session.scholarshipFullyDistributedAt,
        status: session.status,
        movements: JSON.parse(JSON.stringify(movements)),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les infos de Bourse pour une équipe sur une session spécifique.
 */
export async function getTeamScholarshipOnSession(equipeId: string, sessionId: string) {
  try {
    await connectToDb();
    const enrollment = await Enrollement.findOne({
      equipeId: new mongoose.Types.ObjectId(equipeId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
    }).lean();

    const equipe = await Equipe.findById(equipeId).lean();

    return {
      success: true,
      data: {
        enrollment: enrollment ? {
          remainingGames: enrollment.remainingGames ?? 0,
          totalGrantedGames: enrollment.totalGrantedGames ?? 0,
          usedGames: enrollment.usedGames ?? 0,
          status: enrollment.status,
        } : null,
        teamSoldeCDF: equipe?.metriques?.soldeCDF ?? 0,
        teamMatchsWin: equipe?.metriques?.matchsWin ?? 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
