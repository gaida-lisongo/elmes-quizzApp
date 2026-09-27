import 'server-only';
import mongoose, { type ClientSession } from 'mongoose';
import connectToDb from '@/lib/utils/db';
import Partie, { type IPartie, type PartieEndReason } from '@/lib/models/Partie';
import Player from '@/lib/models/Player';
import Quiz from '@/lib/models/Quiz';
import Equipe from '@/lib/models/Equipe';
import EnrollementModule from '@/lib/models/Enrollement';
import { tx, withTransaction } from '@/lib/utils/transaction';
import { creditScholarshipForWonGame, isPartieWon } from '@/lib/utils/scholarship.service';

const { Enrollement } = EnrollementModule;

// ── CONSTANTES DE JEU ──────────────────────────────────────────────

export const TEMPS_PAR_QUESTION = 15_000; // 15 secondes
/** Tolérance réseau après l'expiration de la question. TODO: valeur à confirmer avec le propriétaire. */
export const RESUME_GRACE_MS = 5_000;
export const NB_QUESTIONS: Record<string, number> = {
  STANDALONE: 3,
  ADVANCED: 3,
  VIP: 5,
  AFFILIATION: 3,
};
const POINTS_PAR_BONNE_REPONSE = 1;
const LEVEL_THRESHOLDS = [25, 60, 150]; // seuils × 3 pts : niveau 1 à 75, 2 à 180, 3 à 450 points cumulés
const AFFILIATE_GAMES_PER_VALID_USER = 10;

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
  expiresAt?: string; // Échéance serveur de la question courante (chronomètre calé dessus)
  resumed?: boolean;
}

export interface PartieResultat {
  note: number;
  totalScore: number;
  allCorrect: boolean;
  newLevel: number;
  niveauMonte: boolean;
  partiesRestantes: number;
  equipeCredit: number;
  endReason: PartieEndReason;
  nbQuestions: number;
}

export class GameError extends Error {}

// ── TIRAGE DES QUESTIONS ──────────────────────────────────────────

/**
 * Tire au hasard `nb` questions distinctes dans les catégories cibles, au niveau du joueur,
 * avec repli sur les niveaux inférieurs si la banque est insuffisante (JEU-15).
 * TODO(JEU-15): règle de repli à confirmer par le propriétaire (aujourd'hui : niveau exact, puis inférieurs).
 */
export async function tirerQuestions(categorieIds: string[], playerLevel: number, nb: number): Promise<any[]> {
  const objectIds = categorieIds
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (objectIds.length === 0) return [];

  const picked: any[] = [];
  for (let level = Math.max(0, Math.min(3, playerLevel)); level >= 0 && picked.length < nb; level -= 1) {
    const quizzes = await Quiz.aggregate([
      {
        $match: {
          categorieId: { $in: objectIds },
          level,
          status: true,
          _id: { $nin: picked.map((q) => q._id) },
        },
      },
      { $sample: { size: nb - picked.length } },
    ]);
    picked.push(...quizzes);
  }
  return picked;
}

export const toQuestionJeu = (q: any): QuestionJeu => ({
  _id: q._id.toString(),
  enonce: q.enonce,
  assertions: q.assertions,
  type: q.type,
  level: q.level,
});

function buildPartieData(partie: IPartie | any, quizzes: any[], extra: Partial<PartieActiveData> = {}): PartieActiveData {
  const order = new Map<string, number>((partie.quizIds || []).map((id: any, index: number) => [id.toString(), index] as [string, number]));
  const questions = [...quizzes]
    .sort((a, b) => (order.get(a._id.toString()) ?? 0) - (order.get(b._id.toString()) ?? 0))
    .map(toQuestionJeu);
  return {
    partieId: partie._id.toString(),
    questions,
    questionIndex: partie.currentIndex || 0,
    notes: partie.note || 0,
    playerId: partie.playerId.toString(),
    mode: partie.mode || 'STANDALONE',
    expiresAt: new Date(partie.questionExpiresAt).toISOString(),
    ...extra,
  };
}

// ── CRÉATION (décompte atomique au lancement) ─────────────────────

export interface CreatePartieParams {
  player: any;
  mode: 'STANDALONE' | 'ADVANCED' | 'VIP' | 'AFFILIATION';
  gameSource: 'standard' | 'affiliation' | 'parcours' | 'competition';
  categorieIds: string[];
  enrollmentId?: string;
  questions: any[];
  /** Décompte atomique de la partie, dans la transaction de création. Renvoie le nombre restant. */
  consume: (dbSession: ClientSession | null) => Promise<number | null>;
}

/**
 * Crée la partie et décompte la partie consommée dans une même transaction :
 * un abandon ne rend jamais la partie, et l'index unique « une partie EN_COURS par joueur »
 * annule le décompte si une autre partie vient d'être lancée en parallèle.
 */
export async function createPartie(params: CreatePartieParams): Promise<PartieActiveData> {
  const nbQuestions = NB_QUESTIONS[params.mode];
  if (params.questions.length < nbQuestions) {
    throw new GameError(
      `Pas assez de questions disponibles pour lancer une partie (${params.questions.length}/${nbQuestions}). Le staff a été informé par les statistiques des catégories.`,
    );
  }
  const questions = params.questions.slice(0, nbQuestions);

  try {
    return await withTransaction(async (dbSession) => {
      const remaining = await params.consume(dbSession);
      if (remaining === null) throw new GameError('Vous n’avez plus de parties disponibles.');

      const [partie] = await Partie.create([{
        playerId: params.player._id,
        enrollmentId: params.enrollmentId ? new mongoose.Types.ObjectId(params.enrollmentId) : undefined,
        categorieId: new mongoose.Types.ObjectId(params.categorieIds[0]),
        categorieIds: params.categorieIds.map((id) => new mongoose.Types.ObjectId(id)),
        mode: params.mode,
        gameSource: params.gameSource,
        levelPlayed: params.player.level || 0,
        reponses: [],
        note: 0,
        status: 'EN_COURS',
        questionExpiresAt: new Date(Date.now() + TEMPS_PAR_QUESTION),
        quizIds: questions.map((q) => q._id),
        currentIndex: 0,
        nbQuestions,
        resultApplied: false,
      }], tx(dbSession));

      return buildPartieData(partie, questions, { parties: remaining });
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new GameError('Vous avez déjà une partie en cours.');
    }
    throw error;
  }
}

// ── CLÔTURE : SEUL POINT DE FIN DE PARTIE ─────────────────────────

async function computePartiesRestantes(partie: any, playerId: mongoose.Types.ObjectId, dbSession: ClientSession | null) {
  if (partie.mode === 'STANDALONE') {
    const player = await Player.findById(playerId).select('parties').session(dbSession).lean();
    return player?.parties || 0;
  }
  if (partie.mode === 'AFFILIATION') {
    const [player, affiliates] = await Promise.all([
      Player.findById(playerId).select('usedAffiliateGames').session(dbSession).lean(),
      Player.countDocuments({ referedBy: playerId, _id: { $ne: playerId } }).session(dbSession),
    ]);
    return Math.max(0, affiliates * AFFILIATE_GAMES_PER_VALID_USER - (player?.usedAffiliateGames || 0));
  }
  if (partie.enrollmentId) {
    const enrollment = await Enrollement.findById(partie.enrollmentId).select('remainingGames').session(dbSession).lean();
    return enrollment?.remainingGames || 0;
  }
  return 0;
}

/**
 * Clôture unique d'une partie (EX-JEU-01) :
 * 1. passage atomique EN_COURS → TERMINE avec sa raison de fin ;
 * 2. application des effets une seule fois (verrou resultApplied) : métriques, niveau,
 *    points d'enrôlement, match gagné et Bourse.
 * Idempotent : rappeler finalizePartie sur une partie terminée ne rejoue aucun effet.
 */
export async function finalizePartie(partieId: string, endReason: PartieEndReason): Promise<PartieResultat | null> {
  await connectToDb();
  if (!mongoose.Types.ObjectId.isValid(String(partieId))) return null;

  return withTransaction(async (dbSession) => {
    await Partie.updateOne(
      { _id: partieId, status: 'EN_COURS' },
      { $set: { status: 'TERMINE', endReason, endedAt: new Date() } },
      tx(dbSession),
    );

    // Verrou d'application des effets
    const partie = await Partie.findOneAndUpdate(
      { _id: partieId, status: 'TERMINE', resultApplied: { $ne: true } },
      { $set: { resultApplied: true } },
      { new: true, ...tx(dbSession) },
    ).lean();

    if (!partie) {
      // Effets déjà appliqués : on renvoie l'état actuel sans rien rejouer.
      const done = await Partie.findById(partieId).session(dbSession).lean();
      if (!done) return null;
      const player = await Player.findById(done.playerId).select('level metrics').session(dbSession).lean();
      return {
        note: done.note || 0,
        totalScore: player?.metrics?.totalScore || 0,
        allCorrect: isPartieWon(done),
        newLevel: player?.level || 0,
        niveauMonte: false,
        partiesRestantes: await computePartiesRestantes(done, done.playerId, dbSession),
        equipeCredit: 0,
        endReason: (done.endReason || endReason) as PartieEndReason,
        nbQuestions: done.nbQuestions || 0,
      };
    }

    const note = partie.note || 0;
    const won = isPartieWon(partie);

    // Métriques : incréments atomiques (plus de lecture-modification-écriture sur Player)
    const updatedPlayer = await Player.findOneAndUpdate(
      { _id: partie.playerId },
      { $inc: { 'metrics.totalScore': note, 'metrics.partiesJouees': 1, 'metrics.partiesGagnees': won ? 1 : 0 } },
      { new: true, ...tx(dbSession) },
    ).lean();
    if (!updatedPlayer) throw new Error('Joueur introuvable');

    // Montée de niveau automatique (seuils cumulés)
    const totalScore = updatedPlayer.metrics?.totalScore || 0;
    const previousLevel = updatedPlayer.level || 0;
    let newLevel = previousLevel;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
      if (totalScore >= LEVEL_THRESHOLDS[i] * 3 && i + 1 > newLevel) newLevel = i + 1;
    }
    newLevel = Math.min(3, newLevel);
    if (newLevel > previousLevel) {
      await Player.updateOne({ _id: partie.playerId }, { $max: { level: newLevel } }, tx(dbSession));
    }

    let equipeCredit = 0;
    if (partie.enrollmentId) {
      const enrollment = await Enrollement.findOneAndUpdate(
        { _id: partie.enrollmentId },
        { $inc: { points: note } },
        { new: true, ...tx(dbSession) },
      ).lean();

      if (partie.mode === 'VIP' && won && enrollment?.equipeId) {
        await Equipe.updateOne({ _id: enrollment.equipeId }, { $inc: { 'metriques.matchsWin': 1 } }, tx(dbSession));
        const scholarship = await creditScholarshipForWonGame(partieId, partie.enrollmentId.toString(), dbSession);
        if (scholarship.success && scholarship.rewardCDF) equipeCredit = scholarship.rewardCDF;
      }
    }

    return {
      note,
      totalScore,
      allCorrect: won,
      newLevel,
      niveauMonte: newLevel > previousLevel,
      partiesRestantes: await computePartiesRestantes(partie, partie.playerId, dbSession),
      equipeCredit,
      endReason,
      nbQuestions: partie.nbQuestions || 0,
    };
  });
}

// ── REPRISE OU ÉCHEC D'UNE PARTIE INTERROMPUE (D-01) ──────────────

const isExpired = (partie: { questionExpiresAt?: Date }) =>
  !partie.questionExpiresAt || Date.now() > new Date(partie.questionExpiresAt).getTime() + RESUME_GRACE_MS;

/**
 * - pas de partie en cours → { resumed: null } ;
 * - question courante non expirée → reprise de la même partie ;
 * - partie expirée → clôturée en échec (EXPIRED), questions sans réponse comptées fausses.
 */
export async function resumeOrExpirePartie(playerId: mongoose.Types.ObjectId | string): Promise<{
  resumed: PartieActiveData | null;
  expired?: PartieResultat | null;
}> {
  await connectToDb();
  const partie = await Partie.findOne({ playerId, status: 'EN_COURS' }).lean();
  if (!partie) return { resumed: null };

  // Parties antérieures au correctif (sans liste de questions) : impossibles à reprendre.
  const resumable = Array.isArray(partie.quizIds) && partie.quizIds.length > 0 && Number(partie.nbQuestions || 0) > 0;
  if (!resumable || isExpired(partie)) {
    const expired = await finalizePartie(partie._id.toString(), 'EXPIRED');
    return { resumed: null, expired };
  }

  const quizzes = await Quiz.find({ _id: { $in: partie.quizIds } }).select('enonce assertions type level').lean();
  return { resumed: buildPartieData(partie, quizzes, { resumed: true }) };
}

// ── RÉPONSE À UNE QUESTION ────────────────────────────────────────

export interface SubmitResult {
  estCorrecte: boolean;
  correction?: string;
  finished: boolean;
  resultat?: PartieResultat | null;
  nextIndex?: number;
  expiresAt?: string;
  timeout?: boolean;
}

/**
 * Enregistre la réponse à la question courante (quizIds[currentIndex]) :
 * contrôle du propriétaire, de l'état, du délai (15 s + tolérance), avancement atomique,
 * et clôture côté serveur sur la dernière question ou sur une mauvaise réponse.
 * La bonne réponse n'est renvoyée qu'après la réponse du joueur.
 */
export async function submitReponse(playerId: mongoose.Types.ObjectId, partieId: string, reponseDonnee: string): Promise<SubmitResult> {
  await connectToDb();
  if (!mongoose.Types.ObjectId.isValid(String(partieId))) throw new GameError('Partie introuvable.');

  const partie = await Partie.findOne({ _id: partieId, playerId }).lean();
  if (!partie) throw new GameError('Partie introuvable.');

  if (partie.status !== 'EN_COURS') {
    return { estCorrecte: false, finished: true, resultat: await finalizePartie(partieId, (partie.endReason || 'COMPLETED') as PartieEndReason) };
  }

  const index = partie.currentIndex || 0;
  const nbQuestions = Number(partie.nbQuestions || 0);
  const quizId = partie.quizIds?.[index];
  if (!quizId || nbQuestions <= 0) {
    return { estCorrecte: false, finished: true, resultat: await finalizePartie(partieId, 'EXPIRED') };
  }

  if (isExpired(partie)) {
    return { estCorrecte: false, finished: true, timeout: true, resultat: await finalizePartie(partieId, 'TIMEOUT') };
  }

  const quiz = await Quiz.findById(quizId).select('reponse').lean();
  if (!quiz) throw new GameError('Question introuvable.');

  const reponse = String(reponseDonnee ?? '').slice(0, 2000);
  const estCorrecte = Boolean(reponse.trim()) && quiz.reponse.trim().toLowerCase() === reponse.trim().toLowerCase();
  const nextExpiresAt = new Date(Date.now() + TEMPS_PAR_QUESTION);

  // Avancement atomique : une seule réponse par question, même si la requête est rejouée.
  const advanced = await Partie.findOneAndUpdate(
    { _id: partieId, playerId, status: 'EN_COURS', currentIndex: index },
    {
      $push: { reponses: { quizId, reponseDonnee: reponse, estCorrecte } },
      $inc: { note: estCorrecte ? POINTS_PAR_BONNE_REPONSE : 0, currentIndex: 1 },
      $set: { questionExpiresAt: nextExpiresAt },
    },
    { new: true },
  ).lean();
  if (!advanced) throw new GameError('Réponse déjà enregistrée pour cette question.');

  const isLast = index + 1 >= nbQuestions;
  // Règle actuelle du jeu (tous modes) : une mauvaise réponse termine la partie.
  // TODO: confirmer si une mauvaise réponse arrête aussi la partie en Standalone.
  if (!estCorrecte || isLast) {
    const resultat = await finalizePartie(partieId, estCorrecte ? 'COMPLETED' : 'WRONG_ANSWER');
    return { estCorrecte, correction: quiz.reponse, finished: true, resultat };
  }

  return {
    estCorrecte,
    correction: quiz.reponse,
    finished: false,
    nextIndex: index + 1,
    expiresAt: nextExpiresAt.toISOString(),
  };
}
