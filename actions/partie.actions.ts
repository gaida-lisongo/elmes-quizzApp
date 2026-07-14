'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import mongoose from 'mongoose';
import Player from '@/lib/models/Player';
import User from '@/lib/models/User';
import Partie from '@/lib/models/Partie';
import Quiz from '@/lib/models/Quiz';
import Categorie from '@/lib/models/Categorie';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';
import { Competition, Parcours } from '@/lib/models/Competition';
import { creditScholarshipForWonGame } from '@/lib/utils/scholarship.service';

const { Enrollement } = EnrollementModule;
const PARCOURS_GRANTED_GAMES = 250;
const COMPETITION_GRANTED_GAMES = 250;

// â”€â”€ CONSTANTES DE JEU â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NB_QUESTIONS: Record<string, number> = {
  STANDALONE: 3,
  ADVANCED: 3,
  VIP: 5,
};
const TEMPS_PAR_QUESTION = 15_000; // 15 secondes
const POINTS_PAR_BONNE_REPONSE = 1;
const LEVEL_THRESHOLDS = [25, 60, 150]; // seuils Ã— 3 pts

export interface QuestionJeu {
  _id: string;
  enonce: string;
  assertions: string[];
  type: 'QCM' | 'VRAI_FAUX';
  level: number;
}

export interface PartieActiveData {
  partieId: string;
  questions: QuestionJeu[];
  questionIndex: number;
  notes: number;
  playerId: string;
  credits?: number;
  parties?: number;
  mode: string;
}

// â”€â”€ CATÃ‰GORIES DISPONIBLES (STANDALONE) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getAvailableCategoriesAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();
    const categories = await Categorie.find({ status: true })
      .sort({ designation: 1 })
      .lean();
    return { success: true, categories: JSON.parse(JSON.stringify(categories)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// â”€â”€ ENROLLEMENTS PARCOURS (ADVANCED) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getMyParcoursEnrollmentsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
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

// â”€â”€ ENROLLEMENTS Ã‰QUIPE / COMPÃ‰TITION (VIP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getMyEquipeEnrollmentsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();
    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const equipe = await Equipe.findOne({ membres: { $elemMatch: { player: player._id, status: true } } }).lean();
    if (!equipe) return { success: false, error: 'Aucune Ã©quipe trouvÃ©e' };

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

// â”€â”€ LANCER UNE PARTIE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Tire au hasard N questions depuis les catÃ©gories cibles, filtrÃ©es par level du joueur.
 */
async function tirerQuestions(
  categorieIds: string[],
  playerLevel: number,
  nb: number,
): Promise<any[]> {
  // Ne tirer que les questions du niveau exact du joueur
  const quizLevel = Math.max(0, Math.min(3, playerLevel));

  const objectIds = categorieIds.map(id => new mongoose.Types.ObjectId(id));

  // AgrÃ©gation MongoDB : Ã©chantillonnage alÃ©atoire performant via $sample
  const quizzes = await Quiz.aggregate([
    { $match: { categorieId: { $in: objectIds }, level: quizLevel, status: true } },
    { $sample: { size: nb } },
  ]);

  return quizzes;
}

/**
 * Lancer une partie STANDALONE (par catÃ©gorie)
 */
export async function startStandalonePartieAction(categorieId: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };
    if (player.parties !== undefined && player.parties <= 0) {
      return { success: false, error: 'Vous n\'avez plus de parties disponibles. Veuillez recharger.' };
    }

    // VÃ©rifier qu'il n'y a pas de partie EN_COURS
    const existing = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' }).lean();
    if (existing) {
      return { success: false, error: 'Vous avez dÃ©jÃ  une partie en cours. Terminez-la avant d\'en commencer une nouvelle.' };
    }

    const questions = await tirerQuestions([categorieId], player.level || 0, NB_QUESTIONS.STANDALONE);
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour cette catÃ©gorie Ã  votre niveau.' };
    }

    const partie = await Partie.create({
      playerId: player._id,
      categorieId: new mongoose.Types.ObjectId(categorieId),
      mode: 'STANDALONE',
      gameSource: 'standard',
      levelPlayed: player.level || 0,
      reponses: [],
      note: 0,
      status: 'EN_COURS',
      questionExpiresAt: new Date(Date.now() + TEMPS_PAR_QUESTION),
    });

    const questionJeu: QuestionJeu[] = questions.map((q: any) => ({
      _id: q._id.toString(),
      enonce: q.enonce,
      assertions: q.assertions,
      type: q.type,
      level: q.level,
    }));

    return {
      success: true,
      data: {
        partieId: partie._id.toString(),
        questions: questionJeu,
        questionIndex: 0,
        notes: 0,
        playerId: player._id.toString(),
        parties: player.parties || 0,
        mode: 'STANDALONE',
      } as PartieActiveData,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Lancer une partie PARCOURS (ADVANCED)
 */
export async function startParcoursPartieAction(enrollmentId: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('parcoursId')
      .populate('sessionId', 'status type')
      .lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };
    if (enrollment.status !== 'CONFIRMED') {
      return { success: false, error: 'Vous devez finaliser votre enrôlement avant de jouer cette session.' };
    }
    if (enrollment.playerId?.toString() !== player._id.toString()) {
      return { success: false, error: 'Cet enrollement ne vous appartient pas.' };
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

    // VÃ©rifier le nombre max de parties
    const totalGrantedGames = enrollment.totalGrantedGames || enrollment.maxParties || PARCOURS_GRANTED_GAMES;
    const usedGames = enrollment.usedGames ?? enrollment.parties ?? 0;
    const remainingGames = enrollment.remainingGames && enrollment.remainingGames > 0
      ? enrollment.remainingGames
      : Math.max(0, totalGrantedGames - usedGames);

    if (remainingGames <= 0) {
      return { success: false, error: 'Les parties de cette session sont épuisées.' };
    }

    const questions = await tirerQuestions(
      parcours.categories.map((c: any) => c.toString()),
      player.level || 0,
      NB_QUESTIONS.ADVANCED,
    );
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour ce parcours Ã  votre niveau.' };
    }

    // IncrÃ©menter le compteur de parties de l'enrollment
    const consumedEnrollment = await Enrollement.findOneAndUpdate(
      {
        _id: enrollmentId,
        status: 'CONFIRMED',
        $or: [
          { remainingGames: { $gt: 0 } },
          { totalGrantedGames: { $exists: false } },
          { totalGrantedGames: 0 },
          { $expr: { $lt: ['$usedGames', '$totalGrantedGames'] } },
        ],
      },
      {
        $set: {
          totalGrantedGames,
          maxParties: totalGrantedGames,
          remainingGames: Math.max(0, remainingGames - 1),
        },
        $inc: { parties: 1, usedGames: 1 },
      },
      { new: true },
    ).lean();
    if (!consumedEnrollment) {
      return { success: false, error: 'Les parties de cette session sont épuisées.' };
    }

    const partie = await Partie.create({
      playerId: player._id,
      enrollmentId: enrollment._id,
      categorieId: parcours.categories[0], // premiÃ¨re catÃ©gorie du parcours
      mode: 'ADVANCED',
      gameSource: 'parcours',
      levelPlayed: player.level || 0,
      reponses: [],
      note: 0,
      status: 'EN_COURS',
      questionExpiresAt: new Date(Date.now() + TEMPS_PAR_QUESTION),
    });

    const questionJeu: QuestionJeu[] = questions.map((q: any) => ({
      _id: q._id.toString(),
      enonce: q.enonce,
      assertions: q.assertions,
      type: q.type,
      level: q.level,
    }));

    return {
      success: true,
      data: {
        partieId: partie._id.toString(),
        questions: questionJeu,
        questionIndex: 0,
        notes: 0,
        playerId: player._id.toString(),
        mode: 'ADVANCED',
        parties: consumedEnrollment.remainingGames,
      } as PartieActiveData,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Lancer un MATCH (VIP)
 */
export async function startMatchPartieAction(enrollmentId: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('competitionId')
      .populate('sessionId', 'status type scholarshipRemainingAmountCDF')
      .lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };
    if (enrollment.status !== 'CONFIRMED') {
      return { success: false, error: 'Vous devez finaliser votre enrôlement avant de jouer cette session.' };
    }

    const sessionDoc = enrollment.sessionId as any;
    if (sessionDoc?.status === 'INACTIVE') {
      return {
        success: false,
        error: 'La session est inactive : la Bourse d\'Excellence AcadÃ©mique disponible a Ã©tÃ© entiÃ¨rement distribuÃ©e ou suspendue par la gestion.',
      };
    }
    if (!sessionDoc || sessionDoc.status !== 'COMPLETED') {
      return { success: false, error: 'Les matchs ne sont pas ouverts pour cette session.' };
    }
    if (sessionDoc.type && sessionDoc.type !== 'competition') {
      return { success: false, error: 'Session de compétition invalide.' };
    }

    // Vérifier la Bourse d'Excellence Académique restante
    const scholarshipRemaining = sessionDoc.scholarshipRemainingAmountCDF ?? 0;
    if (scholarshipRemaining <= 0) {
      return {
        success: false,
        error: 'La session est inactive : la Bourse d\'Excellence Académique disponible a été entièrement distribuée ou suspendue par la gestion.',
      };
    }

    const equipe = await Equipe.findOne({
      _id: enrollment.equipeId,
      membres: { $elemMatch: { player: player._id, status: true } },
    }).lean();
    if (!equipe) {
      return { success: false, error: 'Vous devez ÃƒÂªtre membre actif de cette ÃƒÂ©quipe pour jouer ce match.' };
    }

    const competition = enrollment.competitionId as any;
    if (!competition) return { success: false, error: 'CompÃ©tition introuvable' };

    const totalGrantedGames = enrollment.totalGrantedGames || enrollment.maxParties || COMPETITION_GRANTED_GAMES;
    const usedGames = enrollment.usedGames ?? enrollment.parties ?? 0;
    const remainingGames = enrollment.remainingGames && enrollment.remainingGames > 0
      ? enrollment.remainingGames
      : Math.max(0, totalGrantedGames - usedGames);

    if (remainingGames <= 0) {
      return { success: false, error: 'Les parties de cette session sont épuisées.' };
    }

    const questions = await tirerQuestions(
      competition.categories.map((c: any) => c.toString()),
      player.level || 0,
      NB_QUESTIONS.VIP,
    );
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour cette compÃ©tition Ã  votre niveau.' };
    }

    const enrollementData = await Enrollement.findOneAndUpdate(
      {
        _id: enrollmentId,
        status: 'CONFIRMED',
        $or: [
          { remainingGames: { $gt: 0 } },
          { totalGrantedGames: { $exists: false } },
          { totalGrantedGames: 0 },
          { $expr: { $lt: ['$usedGames', '$totalGrantedGames'] } },
        ],
      },
      {
        $set: {
          totalGrantedGames,
          maxParties: totalGrantedGames,
          remainingGames: Math.max(0, remainingGames - 1),
        },
        $inc: { parties: 1, usedGames: 1 },
      },
      { new: true },
    ).lean();
    if (!enrollementData) {
      return { success: false, error: 'Les parties de cette session sont épuisées.' };
    }

    const partie = await Partie.create({
      playerId: player._id,
      enrollmentId: enrollment._id,
      categorieId: competition.categories[0],
      mode: 'VIP',
      gameSource: 'competition',
      levelPlayed: player.level || 0,
      reponses: [],
      note: 0,
      status: 'EN_COURS',
      questionExpiresAt: new Date(Date.now() + TEMPS_PAR_QUESTION),
    });

    const questionJeu: QuestionJeu[] = questions.map((q: any) => ({
      _id: q._id.toString(),
      enonce: q.enonce,
      assertions: q.assertions,
      type: q.type,
      level: q.level,
    }));

    return {
      success: true,
      data: {
        partieId: partie._id.toString(),
        questions: questionJeu,
        questionIndex: 0,
        notes: 0,
        playerId: player._id.toString(),
        mode: 'VIP',
        parties : enrollementData.remainingGames
      } as PartieActiveData,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// â”€â”€ SOUMETTRE UNE RÃ‰PONSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function submitReponseAction(
  partieId: string,
  quizId: string,
  reponseDonnee: string,
) {
  try {
    await connectToDb();
    const quiz = await Quiz.findById(quizId).lean();
    if (!quiz) return { success: false, error: 'Question introuvable' };

    const estCorrecte = quiz.reponse.trim().toLowerCase() === reponseDonnee.trim().toLowerCase();

    await Partie.findByIdAndUpdate(partieId, {
      $push: { reponses: { quizId, reponseDonnee, estCorrecte } },
      $inc: { note: estCorrecte ? POINTS_PAR_BONNE_REPONSE : 0 },
      questionExpiresAt: new Date(Date.now() + TEMPS_PAR_QUESTION),
    });

    return {
      success: true,
      estCorrecte,
      correction: estCorrecte ? undefined : quiz.reponse,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// â”€â”€ TERMINER UNE PARTIE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Termine la partie et met Ã  jour les mÃ©triques du joueur.
 * GÃ¨re la progression de niveau.
 */
export async function terminerPartieAction(partieId: string, credits: number) {
  try {
    await connectToDb();
    const partie = await Partie.findById(partieId).lean();
    if (!partie) return { success: false, error: 'Partie introuvable' };

    const player = await Player.findById(partie.playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    // Marquer comme terminÃ©e
    await Partie.findByIdAndUpdate(partieId, { status: 'TERMINE' });

    // Mettre Ã  jour les mÃ©triques du joueur
    const note = partie.note || 0;
    const allCorrect = partie.reponses?.every((r: any) => r.estCorrecte) ?? false;

    // Mise Ã  jour metrics
    const partiesJouees = (player.metrics?.partiesJouees || 0) + 1;
    const partiesGagnees = (player.metrics?.partiesGagnees || 0) + (allCorrect ? 1 : 0);
    const totalScore = (player.metrics?.totalScore || 0) + note;

    // VÃ©rifier le niveau atteint
    let newLevel = player.level || 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalScore >= LEVEL_THRESHOLDS[i] * 3 && i + 1 > newLevel) {
        newLevel = i + 1;
      }
    }
    if (newLevel > 3) newLevel = 3;

    // DÃ©duire une partie du solde (sauf si partiesInfinity)
    const partiesRestantes = partie.mode === 'STANDALONE'
      ? Math.max(0, (player.parties || 0) - 1)
      : (player.parties || 0);

    await Player.findByIdAndUpdate(player._id, {
      $set: {
        level: newLevel,
        'metrics.totalScore': totalScore,
        'metrics.partiesJouees': partiesJouees,
        'metrics.partiesGagnees': partiesGagnees,
        parties: partiesRestantes,
      },
    });

    let equipeCredit = 0;
    if (partie.enrollmentId) {
      const enrollment = await Enrollement.findByIdAndUpdate(
        partie.enrollmentId,
        { $inc: { points: note } },
        { new: true },
      ).lean();

      if (partie.mode === 'VIP' && allCorrect && enrollment?.equipeId) {
        await Equipe.findByIdAndUpdate(enrollment.equipeId, {
          $inc: {
            'metriques.matchsWin': 1,
          },
        });

        // Créditer la Bourse d'Excellence Académique pour cette partie gagnée
        try {
          const scholarshipRes = await creditScholarshipForWonGame(partieId, partie.enrollmentId.toString());
          if (scholarshipRes.success && scholarshipRes.rewardCDF) {
            equipeCredit = scholarshipRes.rewardCDF;
          }
        } catch (error) {
          console.error('[terminerPartieAction] Erreur crédit Bourse:', error);
        }
      }
    }

    return {
      success: true,
      resultat: {
        note,
        totalScore,
        allCorrect,
        newLevel,
        niveauMonte: newLevel > (player.level || 0),
        partiesRestantes,
        equipeCredit,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// â”€â”€ VÃ‰RIFIER PARTIE EN COURS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getPartieEnCoursAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connectÃ©' };
    await connectToDb();
    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const partie = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' })
      .populate('categorieId', 'designation')
      .lean();

    if (!partie) return { success: false, data: null };

    return {
      success: true,
      data: {
        partieId: partie._id.toString(),
        categorie: (partie.categorieId as any)?.designation || 'CatÃ©gorie',
        status: 'EN_COURS',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

