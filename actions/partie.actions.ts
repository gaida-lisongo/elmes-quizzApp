'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import mongoose from 'mongoose';
import Player from '@/lib/models/Player';
import Partie from '@/lib/models/Partie';
import Categorie from '@/lib/models/Categorie';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';
import { guardPlayer } from '@/lib/utils/guards';
import { isValidObjectId } from '@/lib/utils/security';
import { tx } from '@/lib/utils/transaction';
import { grantSessionGamesAfterEnrollmentValidation } from '@/lib/utils/enrollmentGames';
import {
  GameError,
  NB_QUESTIONS,
  createPartie,
  finalizePartie,
  resumeOrExpirePartie,
  submitReponse,
  tirerQuestions,
  type SubmitResult,
} from '@/lib/services/partie.service';

export type { QuestionJeu, PartieActiveData, PartieResultat } from '@/lib/services/partie.service';

const { Enrollement } = EnrollementModule;
const SESSION_GRANTED_GAMES = 250;

const gameError = (error: any) =>
  ({ success: false as const, error: error instanceof GameError ? error.message : error?.message || 'Erreur de jeu.' });

/**
 * Avant tout lancement : une partie encore valide est reprise, une partie expirée est clôturée
 * en échec (D-01). Renvoie les données de reprise, ou null si l'on peut lancer une nouvelle partie.
 */
async function resumeIfPossible(playerId: mongoose.Types.ObjectId) {
  const { resumed } = await resumeOrExpirePartie(playerId);
  return resumed;
}

/**
 * Enrôlement historique sans compteur remainingGames : normalisation avant le décompte atomique.
 */
async function normalizeEnrollmentCounters(enrollment: any) {
  if (enrollment.status === 'CONFIRMED' && !enrollment.gamesGranted && !enrollment.gamesGrantedAt) {
    await grantSessionGamesAfterEnrollmentValidation(enrollment._id.toString());
  }
  const total = enrollment.totalGrantedGames || enrollment.maxParties || SESSION_GRANTED_GAMES;
  const used = enrollment.usedGames ?? enrollment.parties ?? 0;
  await Enrollement.updateOne(
    { _id: enrollment._id, remainingGames: { $exists: false } },
    { $set: { totalGrantedGames: total, maxParties: total, remainingGames: Math.max(0, total - used) } },
  );
}

/** Décompte atomique d'une partie de session (Parcours ou Match VIP). */
const consumeEnrollmentGame = (enrollmentId: string) => async (dbSession: mongoose.ClientSession | null) => {
  const updated = await Enrollement.findOneAndUpdate(
    { _id: enrollmentId, status: 'CONFIRMED', remainingGames: { $gt: 0 } },
    { $inc: { remainingGames: -1, usedGames: 1, parties: 1 } },
    { new: true, ...tx(dbSession) },
  ).lean();
  return updated ? updated.remainingGames || 0 : null;
};

// ── CATÉGORIES DISPONIBLES (STANDALONE) ────────────────────────────

export async function getAvailableCategoriesAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();
    const categories = await Categorie.find({ status: true })
      .sort({ designation: 1 })
      .lean();
    return { success: true, categories: JSON.parse(JSON.stringify(categories)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENTS PARCOURS (ADVANCED) ───────────────────────────────

export async function getMyParcoursEnrollmentsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();
    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const enrollments = await Enrollement.find({
      playerId: player._id,
      parcoursId: { $exists: true },
      status: { $in: ['PENDING', 'CONFIRMED'] },
    })
      .populate('parcoursId', 'designation description questions slug')
      .populate('sessionId', 'designation startDate endDate status type enrollmentFeeCDF totalValidatedEnrollments totalCollectedCDF platformAmountCDF scholarshipInitialAmountCDF scholarshipDistributedAmountCDF scholarshipRemainingAmountCDF totalGrantedGames unitRewardPerWonGameCDF gamesPerEnrollment')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, enrollments: JSON.parse(JSON.stringify(enrollments)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENTS ÉQUIPE / COMPÉTITION (VIP) ────────────────────────

export async function getMyEquipeEnrollmentsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();
    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const equipe = await Equipe.findOne({ membres: { $elemMatch: { player: player._id, status: true } } }).lean();
    if (!equipe) return { success: false, error: 'Aucune équipe trouvée' };

    const enrollments = await Enrollement.find({
      equipeId: equipe._id,
      competitionId: { $exists: true },
      status: 'CONFIRMED',
    })
      .populate('competitionId', 'designation description categories questions slug')
      .populate('sessionId', 'designation startDate endDate status type enrollmentFeeCDF totalValidatedEnrollments totalCollectedCDF platformAmountCDF scholarshipInitialAmountCDF scholarshipDistributedAmountCDF scholarshipRemainingAmountCDF totalGrantedGames unitRewardPerWonGameCDF gamesPerEnrollment')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, enrollments: JSON.parse(JSON.stringify(enrollments)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── LANCER UNE PARTIE ──────────────────────────────────────────────

/**
 * Lancer une partie STANDALONE (par catégorie).
 * La partie est décomptée au lancement (JEU-08) ; un abandon ne la rend pas.
 */
export async function startStandalonePartieAction(categorieId: string) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    const player = guard.player;

    const resumed = await resumeIfPossible(player._id as mongoose.Types.ObjectId);
    if (resumed) return { success: true, resumed: true, data: resumed };

    if (!isValidObjectId(categorieId)) return { success: false, error: 'Catégorie invalide.' };
    // JEU-16 : la catégorie doit exister et être active.
    const categorie = await Categorie.exists({ _id: categorieId, status: true });
    if (!categorie) return { success: false, error: 'Catégorie introuvable ou inactive.' };

    if ((player.parties || 0) <= 0) {
      return { success: false, error: 'Vous n\'avez plus de parties disponibles. Veuillez recharger.' };
    }

    const questions = await tirerQuestions([categorieId], player.level || 0, NB_QUESTIONS.STANDALONE);
    const data = await createPartie({
      player,
      mode: 'STANDALONE',
      gameSource: 'standard',
      categorieIds: [categorieId],
      questions,
      consume: async (dbSession) => {
        const updated = await Player.findOneAndUpdate(
          { _id: player._id, parties: { $gt: 0 } },
          { $inc: { parties: -1 } },
          { new: true, ...tx(dbSession) },
        ).lean();
        return updated ? updated.parties || 0 : null;
      },
    });

    return { success: true, resumed: false, data };
  } catch (error: any) {
    return gameError(error);
  }
}

/**
 * Lancer une partie PARCOURS (ADVANCED)
 */
export async function startParcoursPartieAction(enrollmentId: string) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    const player = guard.player;

    const resumed = await resumeIfPossible(player._id as mongoose.Types.ObjectId);
    if (resumed) return { success: true, resumed: true, data: resumed };

    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Inscription introuvable' };
    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('parcoursId')
      .populate('sessionId', 'status type')
      .lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };
    if (enrollment.status !== 'CONFIRMED') {
      return { success: false, error: 'Vous devez finaliser votre enrôlement avant de jouer cette session.' };
    }
    if (enrollment.playerId?.toString() !== player._id.toString()) {
      return { success: false, error: 'Cet enrôlement ne vous appartient pas.' };
    }

    const sessionDoc = enrollment.sessionId as any;
    if (!sessionDoc || sessionDoc.status !== 'ACTIVE') {
      return { success: false, error: 'Cette session de parcours n’est pas active.' };
    }
    if (sessionDoc.type && sessionDoc.type !== 'parcours') {
      return { success: false, error: 'Session de parcours invalide.' };
    }

    const parcours = enrollment.parcoursId as any;
    if (!parcours) return { success: false, error: 'Parcours introuvable' };

    await normalizeEnrollmentCounters(enrollment);

    // JEU-13 : toutes les catégories du parcours sont enregistrées dans la partie.
    const categorieIds = (parcours.categories || []).map((c: any) => c.toString());
    const questions = await tirerQuestions(categorieIds, player.level || 0, NB_QUESTIONS.ADVANCED);
    const data = await createPartie({
      player,
      mode: 'ADVANCED',
      gameSource: 'parcours',
      categorieIds,
      enrollmentId,
      questions,
      consume: consumeEnrollmentGame(enrollmentId),
    });

    return { success: true, resumed: false, data };
  } catch (error: any) {
    return gameError(error);
  }
}

/**
 * Lancer un MATCH (VIP)
 */
export async function startMatchPartieAction(enrollmentId: string) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    const player = guard.player;

    const resumed = await resumeIfPossible(player._id as mongoose.Types.ObjectId);
    if (resumed) return { success: true, resumed: true, data: resumed };

    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Inscription introuvable' };
    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('competitionId')
      .populate('sessionId', 'status type scholarshipRemainingAmountCDF')
      .lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };
    if (enrollment.status !== 'CONFIRMED') {
      return { success: false, error: 'Vous devez finaliser votre enrôlement avant de jouer cette session.' };
    }

    const sessionDoc = enrollment.sessionId as any;
    const inactiveMessage = 'La session est inactive : la Bourse d\'Excellence Académique disponible a été entièrement distribuée ou suspendue par la gestion.';
    if (sessionDoc?.status === 'INACTIVE') {
      return { success: false, error: inactiveMessage };
    }
    if (!sessionDoc || sessionDoc.status !== 'COMPLETED') {
      return { success: false, error: 'Les matchs ne sont pas ouverts pour cette session.' };
    }
    if (sessionDoc.type && sessionDoc.type !== 'competition') {
      return { success: false, error: 'Session de compétition invalide.' };
    }
    if ((sessionDoc.scholarshipRemainingAmountCDF ?? 0) <= 0) {
      return { success: false, error: inactiveMessage };
    }

    const equipe = await Equipe.findOne({
      _id: enrollment.equipeId,
      membres: { $elemMatch: { player: player._id, status: true } },
    }).lean();
    if (!equipe) {
      return { success: false, error: 'Vous devez être membre actif de cette équipe pour jouer ce match.' };
    }

    const competition = enrollment.competitionId as any;
    if (!competition) return { success: false, error: 'Compétition introuvable' };

    await normalizeEnrollmentCounters(enrollment);

    const categorieIds = (competition.categories || []).map((c: any) => c.toString());
    const questions = await tirerQuestions(categorieIds, player.level || 0, NB_QUESTIONS.VIP);
    const data = await createPartie({
      player,
      mode: 'VIP',
      gameSource: 'competition',
      categorieIds,
      enrollmentId,
      questions,
      consume: consumeEnrollmentGame(enrollmentId),
    });

    return { success: true, resumed: false, data };
  } catch (error: any) {
    return gameError(error);
  }
}

// ── SOUMETTRE UNE RÉPONSE ──────────────────────────────────────────

/**
 * Réponse à la question courante. Le client n'envoie plus l'identifiant de la question :
 * le serveur répond à quizIds[currentIndex], contrôle le délai et clôt la partie lui-même.
 */
export async function submitReponseAction(
  partieId: string,
  reponseDonnee: string,
): Promise<{ success: boolean; error?: string } & Partial<SubmitResult>> {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };

    const result = await submitReponse(guard.player._id as mongoose.Types.ObjectId, partieId, reponseDonnee);
    return { success: true, ...result };
  } catch (error: any) {
    return gameError(error);
  }
}

// ── TERMINER / ABANDONNER UNE PARTIE ───────────────────────────────

/**
 * Adaptateur de compatibilité : clôt la partie du joueur connecté via finalizePartie (idempotent).
 * Une partie encore en cours est clôturée comme abandonnée (jamais gagnée sans réponses).
 */
export async function terminerPartieAction(partieId: string) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(partieId)) return { success: false, error: 'Partie introuvable' };

    const partie = await Partie.findOne({ _id: partieId, playerId: guard.player._id }).select('_id endReason').lean();
    if (!partie) return { success: false, error: 'Partie introuvable' };

    const resultat = await finalizePartie(partieId, (partie.endReason || 'ABANDONED') as any);
    return { success: true, resultat };
  } catch (error: any) {
    return gameError(error);
  }
}

/**
 * Abandon volontaire : la partie est clôturée en échec (ABANDONED), déjà décomptée.
 */
export async function abandonnerPartieAction() {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };

    const partie = await Partie.findOne({ playerId: guard.player._id, status: 'EN_COURS' }).select('_id').lean();
    if (!partie) return { success: true, resultat: null };

    const resultat = await finalizePartie(partie._id.toString(), 'ABANDONED');
    return { success: true, resultat };
  } catch (error: any) {
    return gameError(error);
  }
}

// ── VÉRIFIER PARTIE EN COURS ───────────────────────────────────────

/**
 * Partie en cours du joueur connecté : reprise si la question courante n'est pas expirée,
 * sinon clôture en échec (EXPIRED) et `data: null`.
 */
export async function getPartieEnCoursAction() {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error, data: null };

    const { resumed, expired } = await resumeOrExpirePartie(guard.player._id as mongoose.Types.ObjectId);
    return { success: true, data: resumed, expired: expired || null };
  } catch (error: any) {
    return { ...gameError(error), data: null };
  }
}
