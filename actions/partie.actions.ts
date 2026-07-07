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

const { Enrollement } = EnrollementModule;

// ── CONSTANTES DE JEU ──────────────────────────────────────────────

const NB_QUESTIONS: Record<string, number> = {
  STANDALONE: 3,
  ADVANCED: 3,
  VIP: 5,
};
const TEMPS_PAR_QUESTION = 15_000; // 15 secondes
const POINTS_PAR_BONNE_REPONSE = 1;
const LEVEL_THRESHOLDS = [25, 60, 150]; // seuils × 3 pts

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
  mode: string;
}

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

// ── ENROLLEMENTS PARCOURS (ADVANCED) ──────────────────────────────

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
      .populate('sessionId', 'designation startDate endDate')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, enrollments: JSON.parse(JSON.stringify(enrollments)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENTS ÉQUIPE / COMPÉTITION (VIP) ───────────────────────

export async function getMyEquipeEnrollmentsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();
    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const equipe = await Equipe.findOne({ membres: { $elemMatch: { player: player._id } } }).lean();
    if (!equipe) return { success: false, error: 'Aucune équipe trouvée' };

    const enrollments = await Enrollement.find({
      equipeId: equipe._id,
      competitionId: { $exists: true },
    })
      .populate('competitionId', 'designation description categories questions slug')
      .populate('sessionId', 'designation startDate endDate')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, enrollments: JSON.parse(JSON.stringify(enrollments)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── LANCER UNE PARTIE ─────────────────────────────────────────────

/**
 * Tire au hasard N questions depuis les catégories cibles, filtrées par level du joueur.
 */
async function tirerQuestions(
  categorieIds: string[],
  playerLevel: number,
  nb: number,
): Promise<any[]> {
  // Construire les niveaux autorisés (castés en number pour MongoDB)
  const quizLevels: number[] = [0, 1, 2, 3].filter(l => l <= playerLevel);
  if (playerLevel >= 3) quizLevels.push(3);

  const objectIds = categorieIds.map(id => new mongoose.Types.ObjectId(id));

  // Agrégation MongoDB : échantillonnage aléatoire performant via $sample
  const quizzes = await Quiz.aggregate([
    { $match: { categorieId: { $in: objectIds }, level: { $in: quizLevels }, status: true } },
    { $sample: { size: nb } },
  ]);

  return quizzes;
}

/**
 * Lancer une partie STANDALONE (par catégorie)
 */
export async function startStandalonePartieAction(categorieId: string) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };
    if (player.parties !== undefined && player.parties <= 0) {
      return { success: false, error: 'Vous n\'avez plus de parties disponibles. Veuillez recharger.' };
    }

    // Vérifier qu'il n'y a pas de partie EN_COURS
    const existing = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' }).lean();
    if (existing) {
      return { success: false, error: 'Vous avez déjà une partie en cours. Terminez-la avant d\'en commencer une nouvelle.' };
    }

    const questions = await tirerQuestions([categorieId], player.level || 0, NB_QUESTIONS.STANDALONE);
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour cette catégorie à votre niveau.' };
    }

    const partie = await Partie.create({
      playerId: player._id,
      categorieId: new mongoose.Types.ObjectId(categorieId),
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
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const enrollment = await Enrollement.findById(enrollmentId).populate('parcoursId').lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };

    const parcours = enrollment.parcoursId as any;
    if (!parcours) return { success: false, error: 'Parcours introuvable' };

    // Vérifier le nombre max de parties
    if (enrollment.parties >= (parcours.questions || 0)) {
      return { success: false, error: 'Vous avez atteint le nombre maximum de parties pour ce parcours.' };
    }

    // Vérifier partie en cours
    const existing = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' }).lean();
    if (existing) {
      return { success: false, error: 'Vous avez déjà une partie en cours.' };
    }

    const questions = await tirerQuestions(
      parcours.categories.map((c: any) => c.toString()),
      player.level || 0,
      NB_QUESTIONS.ADVANCED,
    );
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour ce parcours à votre niveau.' };
    }

    // Incrémenter le compteur de parties de l'enrollment
    await Enrollement.findByIdAndUpdate(enrollmentId, { $inc: { parties: 1 } });

    const partie = await Partie.create({
      playerId: player._id,
      categorieId: parcours.categories[0], // première catégorie du parcours
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
    if (!session) return { success: false, error: 'Non connecté' };
    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const enrollment = await Enrollement.findById(enrollmentId).populate('competitionId').lean();
    if (!enrollment) return { success: false, error: 'Inscription introuvable' };

    const competition = enrollment.competitionId as any;
    if (!competition) return { success: false, error: 'Compétition introuvable' };

    // Vérifier partie en cours
    const existing = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' }).lean();
    if (existing) {
      return { success: false, error: 'Vous avez déjà une partie en cours.' };
    }

    const questions = await tirerQuestions(
      competition.categories.map((c: any) => c.toString()),
      player.level || 0,
      NB_QUESTIONS.VIP,
    );
    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour cette compétition à votre niveau.' };
    }

    await Enrollement.findByIdAndUpdate(enrollmentId, { $inc: { parties: 1 } });

    const partie = await Partie.create({
      playerId: player._id,
      categorieId: competition.categories[0],
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
      } as PartieActiveData,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── SOUMETTRE UNE RÉPONSE ─────────────────────────────────────────

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

// ── TERMINER UNE PARTIE ────────────────────────────────────────────

/**
 * Termine la partie et met à jour les métriques du joueur.
 * Gère la progression de niveau.
 */
export async function terminerPartieAction(partieId: string) {
  try {
    await connectToDb();
    const partie = await Partie.findById(partieId).lean();
    if (!partie) return { success: false, error: 'Partie introuvable' };

    const player = await Player.findById(partie.playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    // Marquer comme terminée
    await Partie.findByIdAndUpdate(partieId, { status: 'TERMINE' });

    // Mettre à jour les métriques du joueur
    const note = partie.note || 0;
    const allCorrect = partie.reponses?.every((r: any) => r.estCorrecte) ?? false;

    // Mise à jour metrics
    const partiesJouees = (player.metrics?.partiesJouees || 0) + 1;
    const partiesGagnees = (player.metrics?.partiesGagnees || 0) + (allCorrect ? 1 : 0);
    const totalScore = (player.metrics?.totalScore || 0) + note;

    // Vérifier le niveau atteint
    let newLevel = player.level || 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalScore >= LEVEL_THRESHOLDS[i] * 3 && i + 1 > newLevel) {
        newLevel = i + 1;
      }
    }
    if (newLevel > 3) newLevel = 3;

    // Déduire une partie du solde (sauf si partiesInfinity)
    const partiesRestantes = Math.max(0, (player.parties || 0) - 1);

    await Player.findByIdAndUpdate(player._id, {
      $set: {
        level: newLevel,
        'metrics.totalScore': totalScore,
        'metrics.partiesJouees': partiesJouees,
        'metrics.partiesGagnees': partiesGagnees,
        parties: partiesRestantes,
      },
    });

    return {
      success: true,
      resultat: {
        note,
        totalScore,
        allCorrect,
        newLevel,
        niveauMonte: newLevel > (player.level || 0),
        partiesRestantes,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── VÉRIFIER PARTIE EN COURS ──────────────────────────────────────

export async function getPartieEnCoursAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };
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
        categorie: (partie.categorieId as any)?.designation || 'Catégorie',
        status: 'EN_COURS',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}