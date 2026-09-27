import 'server-only';

// Plus de directive 'use server' (PAY-17) : ces fonctions de crédit ne sont jamais des points
// d'entrée publics. Les contrôles d'accès se font dans les actions qui les appellent.

import mongoose, { type ClientSession } from 'mongoose';
import connectToDb from '@/lib/utils/db';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';
import Partie from '@/lib/models/Partie';
import ScholarshipMovement from '@/lib/models/ScholarshipMovement';
import { tx, withTransaction } from '@/lib/utils/transaction';

const { Enrollement, Session } = EnrollementModule;

// ── CONSTANTES ─────────────────────────────────────────────────────

const DEFAULT_PLATFORM_RATE = 0.35;
const DEFAULT_SCHOLARSHIP_RATE = 0.65;
const DEFAULT_GAMES_PER_ENROLLMENT = 250;

/**
 * Commission du fournisseur de paiement, déduite avant la répartition 35 % / 65 % (Q-01 : calcul sur le net).
 * D-02 : 3,5 % pour le SDK @elmes/payment-sdk.
 * TODO(Q-01): confirmer le taux applicable tant que FlexPay reste en service ; surchargeable par PAYMENT_COMMISSION_RATE.
 */
export const PAYMENT_COMMISSION_RATE =
  Number.isFinite(Number(process.env.PAYMENT_COMMISSION_RATE)) && process.env.PAYMENT_COMMISSION_RATE !== undefined
    ? Number(process.env.PAYMENT_COMMISSION_RATE)
    : 0.035;

// ── UTILITAIRES ────────────────────────────────────────────────────

const floorCDF = (value: number): number => Math.floor(Math.max(0, value));

/**
 * Montant CDF réellement encaissé pour un enrôlement (EX-PAY-06, PAY-15) :
 * paidAmountCDF (équivalent CDF du paiement), sinon amountCDF (prix serveur à l'initiation),
 * sinon Competition.amount pour les enrôlements historiques.
 */
function resolveEnrollmentCollectedCDF(enrollment: any): number {
  const paid = Number(enrollment.paidAmountCDF || 0);
  if (paid > 0) return floorCDF(paid);
  const expected = Number(enrollment.amountCDF || 0);
  if (expected > 0) return floorCDF(expected);
  return floorCDF(Number(enrollment.competitionId?.amount || 0));
}

// ── RECALCUL DE LA BOURSE ─────────────────────────────────────────

/**
 * Recalcule la Bourse d'Excellence Académique pour une session de compétition.
 * Appelé après chaque validation d'enrôlement. La Bourse restante est recalculée de façon atomique
 * (Bourse initiale - Bourse déjà distribuée), sans écraser les crédits concurrents.
 */
export async function recomputeCompetitionScholarship(
  sessionId: string,
  dbSession: ClientSession | null = null,
): Promise<{
  success: boolean;
  error?: string;
  data?: any;
}> {
  try {
    await connectToDb();

    const session = await Session.findById(sessionId).session(dbSession);
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
      .session(dbSession)
      .lean();

    if (validatedEnrollments.length === 0) {
      return { success: false, error: 'Aucun enrôlement validé pour cette session' };
    }

    let enrollmentFeeCDF = 0;
    let totalCollectedCDF = 0;
    for (const enrollment of validatedEnrollments as any[]) {
      const amount = resolveEnrollmentCollectedCDF(enrollment);
      if (amount > 0) {
        if (enrollmentFeeCDF <= 0) enrollmentFeeCDF = floorCDF(Number(enrollment.amountCDF || enrollment.competitionId?.amount || amount));
        totalCollectedCDF += amount;
      }
    }

    if (totalCollectedCDF <= 0) {
      return { success: false, error: 'Aucun montant CDF valide disponible pour calculer la Bourse' };
    }

    const totalValidatedEnrollments = validatedEnrollments.length;
    const platformRate = session.platformRate ?? DEFAULT_PLATFORM_RATE;
    const scholarshipRate = session.scholarshipRate ?? DEFAULT_SCHOLARSHIP_RATE;
    const gamesPerEnrollment = session.gamesPerEnrollment ?? DEFAULT_GAMES_PER_ENROLLMENT;
    const commissionRate = Math.min(Math.max(PAYMENT_COMMISSION_RATE, 0), 1);

    // Q-01 : répartition 35 % / 65 % sur le net de la commission du fournisseur.
    const netCollectedCDF = floorCDF(totalCollectedCDF * (1 - commissionRate));
    const platformAmountCDF = floorCDF(netCollectedCDF * platformRate);
    const scholarshipInitialAmountCDF = floorCDF(netCollectedCDF * scholarshipRate);
    const totalGrantedGames = totalValidatedEnrollments * gamesPerEnrollment;
    const unitRewardPerWonGameCDF = totalGrantedGames > 0
      ? floorCDF(scholarshipInitialAmountCDF / totalGrantedGames)
      : 0;

    const beforeRemaining = session.scholarshipRemainingAmountCDF ?? 0;

    // Mise à jour atomique : la Bourse restante dépend de la Bourse distribuée au moment de l'écriture.
    const updated = await Session.findOneAndUpdate(
      { _id: session._id },
      [
        {
          $set: {
            enrollmentFeeCDF,
            platformRate,
            scholarshipRate,
            gamesPerEnrollment,
            paymentCommissionRate: commissionRate,
            totalValidatedEnrollments,
            totalCollectedCDF,
            netCollectedCDF,
            platformAmountCDF,
            scholarshipInitialAmountCDF,
            totalGrantedGames,
            unitRewardPerWonGameCDF,
            lastScholarshipComputedAt: '$$NOW',
            scholarshipDistributedAmountCDF: { $ifNull: ['$scholarshipDistributedAmountCDF', 0] },
            scholarshipRemainingAmountCDF: {
              $max: [0, { $subtract: [scholarshipInitialAmountCDF, { $ifNull: ['$scholarshipDistributedAmountCDF', 0] }] }],
            },
          },
        },
      ],
      { new: true, ...tx(dbSession) },
    ).lean();

    const alreadyDistributed = updated?.scholarshipDistributedAmountCDF ?? 0;
    const scholarshipRemainingAmountCDF = updated?.scholarshipRemainingAmountCDF ?? 0;

    // Enregistrer le mouvement
    await ScholarshipMovement.create([{
      sessionId: session._id,
      type: 'scholarship_recompute',
      amountCDF: scholarshipInitialAmountCDF,
      beforeRemainingCDF: beforeRemaining,
      afterRemainingCDF: scholarshipRemainingAmountCDF,
      createdBy: 'SYSTEM',
      note: `Recalcul après ${totalValidatedEnrollments} enrôlement(s) validé(s) : ${totalCollectedCDF} FC encaissés, ${netCollectedCDF} FC nets`,
    }], tx(dbSession));

    return {
      success: true,
      data: {
        enrollmentFeeCDF,
        totalValidatedEnrollments,
        totalCollectedCDF,
        netCollectedCDF,
        platformAmountCDF,
        scholarshipInitialAmountCDF,
        scholarshipDistributedAmountCDF: alreadyDistributed,
        scholarshipRemainingAmountCDF,
        totalGrantedGames,
        unitRewardPerWonGameCDF,
      },
    };
  } catch (error: any) {
    if (dbSession) throw error; // Laisser la transaction appelante s'annuler
    return { success: false, error: error.message };
  }
}

// ── CRÉDIT PAR PARTIE GAGNÉE ──────────────────────────────────────

/**
 * Une partie est gagnée si et seulement si elle s'est terminée normalement, avec toutes ses
 * questions répondues et toutes justes (correction JEU-04 : une partie vide n'est plus gagnée).
 */
export function isPartieWon(partie: {
  endReason?: string;
  reponses?: Array<{ estCorrecte: boolean }>;
  nbQuestions?: number;
}) {
  const reponses = partie.reponses || [];
  const expected = Number(partie.nbQuestions || 0);
  return (
    partie.endReason === 'COMPLETED' &&
    expected > 0 &&
    reponses.length === expected &&
    reponses.every((r) => r.estCorrecte)
  );
}

/**
 * Crédite la Bourse à une équipe lorsqu'elle gagne un match.
 * Appelé par finalizePartie, dans sa transaction : verrou de la partie, décrément conditionnel de la
 * Bourse de session, crédit de la caisse d'équipe et journal ScholarshipMovement bougent ensemble.
 */
export async function creditScholarshipForWonGame(
  partieId: string,
  enrollmentId: string,
  dbSession: ClientSession | null = null,
): Promise<{ success: boolean; error?: string; rewardCDF?: number }> {
  await connectToDb();

  const partie = await Partie.findById(partieId).session(dbSession).lean();
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

  if (!isPartieWon(partie)) {
    return { success: false, error: 'La partie n\'est pas entièrement gagnée' };
  }

  const enrollment = await Enrollement.findById(enrollmentId)
    .populate('sessionId')
    .session(dbSession)
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

  // Vérifier que la session est ouverte
  if (!['ACTIVE', 'COMPLETED'].includes(session.status)) {
    return { success: false, error: 'La session est inactive : la Bourse d\'Excellence Académique disponible a été entièrement distribuée ou suspendue par la gestion.' };
  }

  const unitReward = session.unitRewardPerWonGameCDF ?? 0;
  if (unitReward <= 0) {
    return { success: false, error: 'Valeur unitaire de Bourse non calculée. Recalculez la Bourse de session.' };
  }

  const currentRemaining = session.scholarshipRemainingAmountCDF ?? 0;
  if (currentRemaining <= 0) {
    await Session.updateOne(
      { _id: sessionId, status: { $ne: 'INACTIVE' } },
      { $set: { status: 'INACTIVE', scholarshipFullyDistributedAt: new Date() } },
      tx(dbSession),
    );
    return { success: false, error: 'La Bourse d\'Excellence Académique est épuisée' };
  }

  const rewardCDF = Math.min(unitReward, currentRemaining);

  // Décrément conditionnel de la Bourse restante (jamais négative). Fait en premier : s'il échoue
  // (Bourse consommée entre-temps), rien n'a été modifié et la clôture de la partie se poursuit.
  const updatedSession = await Session.findOneAndUpdate(
    { _id: sessionId, scholarshipRemainingAmountCDF: { $gte: rewardCDF } },
    {
      $inc: {
        scholarshipDistributedAmountCDF: rewardCDF,
        scholarshipRemainingAmountCDF: -rewardCDF,
      },
    },
    { new: true, ...tx(dbSession) },
  ).lean();
  if (!updatedSession) {
    return { success: false, error: 'Bourse restante insuffisante pour créditer cette partie' };
  }

  // Verrou de la partie : un seul crédit par match
  const lockedPartie = await Partie.findOneAndUpdate(
    { _id: partieId, scholarshipCredited: { $ne: true }, status: 'TERMINE' },
    { $set: { scholarshipCredited: true } },
    { new: true, ...tx(dbSession) },
  ).lean();
  if (!lockedPartie) {
    // Déjà créditée : on rend le montant à la Bourse (dans une transaction, l'annulation suffit).
    if (dbSession) throw new Error('Cette partie a déjà été récompensée');
    await Session.updateOne(
      { _id: sessionId },
      { $inc: { scholarshipDistributedAmountCDF: -rewardCDF, scholarshipRemainingAmountCDF: rewardCDF } },
    );
    return { success: false, error: 'Cette partie a déjà été récompensée' };
  }

  // Créditer la caisse de l'équipe
  await Equipe.updateOne({ _id: equipeId }, { $inc: { 'metriques.soldeCDF': rewardCDF } }, tx(dbSession));

  const afterRemaining = updatedSession.scholarshipRemainingAmountCDF ?? 0;

  // Enregistrer le mouvement
  await ScholarshipMovement.create([{
    sessionId: new mongoose.Types.ObjectId(sessionId),
    teamId: new mongoose.Types.ObjectId(equipeId),
    enrollmentId: new mongoose.Types.ObjectId(enrollmentId),
    gameId: new mongoose.Types.ObjectId(partieId),
    type: 'reward_per_won_game',
    amountCDF: rewardCDF,
    beforeRemainingCDF: afterRemaining + rewardCDF,
    afterRemainingCDF: afterRemaining,
    createdBy: 'SYSTEM',
    note: `Crédit de ${rewardCDF} FC pour partie gagnée`,
  }], tx(dbSession));

  // Bourse épuisée : la session passe INACTIVE
  if (afterRemaining <= 0) {
    await Session.updateOne(
      { _id: sessionId },
      { $set: { status: 'INACTIVE', scholarshipFullyDistributedAt: new Date() } },
      tx(dbSession),
    );
  }

  return { success: true, rewardCDF };
}

// ── ACTION ADMIN : PRIMER UNE ÉQUIPE ──────────────────────────────

/**
 * Attribue tout ou partie de la Bourse restante à une équipe (clôture de session).
 * Transactionnel ; le contrôle d'accès (ADMIN) est fait par l'action appelante.
 */
export async function awardRemainingScholarshipToTeam(
  sessionId: string,
  teamId: string,
  amount?: number,
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    if (!mongoose.Types.ObjectId.isValid(String(sessionId)) || !mongoose.Types.ObjectId.isValid(String(teamId))) {
      return { success: false, error: 'Paramètres invalides' };
    }

    return await withTransaction(async (dbSession) => {
      const session = await Session.findById(sessionId).session(dbSession);
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
      }).session(dbSession).lean();

      if (!enrollment) {
        return { success: false, error: 'Cette équipe n\'est pas enrôlée dans cette session' };
      }

      const hasAmount = amount !== undefined && amount !== null && String(amount) !== '';
      const awardAmount = hasAmount ? floorCDF(Number(amount)) : remaining;
      if (!Number.isFinite(awardAmount) || awardAmount <= 0) {
        return { success: false, error: 'Montant invalide' };
      }
      if (awardAmount > remaining) {
        return { success: false, error: 'Le montant demandé dépasse la Bourse restante' };
      }

      // Décrément conditionnel : la Bourse ne peut pas devenir négative
      const updatedSession = await Session.findOneAndUpdate(
        { _id: sessionId, scholarshipRemainingAmountCDF: { $gte: awardAmount } },
        { $inc: { scholarshipDistributedAmountCDF: awardAmount, scholarshipRemainingAmountCDF: -awardAmount } },
        { new: true, ...tx(dbSession) },
      ).lean();
      if (!updatedSession) {
        return { success: false, error: 'La Bourse restante a changé, réessayez.' };
      }

      await Equipe.updateOne({ _id: teamId }, { $inc: { 'metriques.soldeCDF': awardAmount } }, tx(dbSession));

      const afterRemaining = updatedSession.scholarshipRemainingAmountCDF ?? 0;
      if (afterRemaining <= 0) {
        await Session.updateOne(
          { _id: sessionId },
          { $set: { status: 'INACTIVE', scholarshipFullyDistributedAt: new Date() } },
          tx(dbSession),
        );
      }

      await ScholarshipMovement.create([{
        sessionId: session._id,
        teamId: new mongoose.Types.ObjectId(teamId),
        enrollmentId: enrollment._id,
        type: 'scholarship_admin_award',
        amountCDF: awardAmount,
        beforeRemainingCDF: afterRemaining + awardAmount,
        afterRemainingCDF: afterRemaining,
        createdBy: 'ADMIN',
        note: hasAmount
          ? `Prime de clôture de session : ${awardAmount} FC attribués à l'équipe`
          : `Prime complémentaire d'excellence : total restant de ${awardAmount} FC attribué à l'équipe`,
      }], tx(dbSession));

      return {
        success: true,
        data: {
          awardAmount,
          beforeRemaining: afterRemaining + awardAmount,
          afterRemaining,
          teamId,
          scholarshipFullyDistributed: afterRemaining <= 0,
        },
      };
    });
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
        netCollectedCDF: session.netCollectedCDF ?? 0,
        paymentCommissionRate: session.paymentCommissionRate ?? PAYMENT_COMMISSION_RATE,
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
