'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import { guardStaff } from '@/lib/utils/guards';
import { grantPlayerBonusPartiesAction } from '@/actions/player.metrics.actions';
import BonusRun from '@/lib/models/BonusRun';
import Quiz from '@/lib/models/Quiz';
import { withTransaction, tx } from '@/lib/utils/transaction';

const WEEKLY_BONUS_STANDALONE = 20;
const WEEKLY_BONUS_ADVANCED = 30;
// Un match VIP demande 5 questions : en dessous, une catégorie ne permet pas de jouer à ce niveau (JEU-12).
const MIN_QUESTIONS_PER_LEVEL = 5;

/** Semaine ISO 8601, ex. « 2026-W39 ». */
function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
import mongoose from 'mongoose';
import { Competition, Parcours, Critere } from '@/lib/models/Competition';
import EnrollementModule from '@/lib/models/Enrollement';
import Player from '@/lib/models/Player';
import Equipe from '@/lib/models/Equipe';
import Categorie from '@/lib/models/Categorie';
import Partie from '@/lib/models/Partie';

const { Enrollement } = EnrollementModule;

// ── CRUD CRITÈRES ─────────────────────────────────────────────────

export async function getCriteresAction() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const criterres = await Critere.find({})
      .populate('sessionId', 'designation')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, criteres: JSON.parse(JSON.stringify(criterres)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCritereAction(data: {
  sessionId: string;
  designation: string;
  description: string;
  firstRecompense: string;
  secondRecompense: string;
  thirdRecompense: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const slug = data.designation.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const payload: any = {
      designation: data.designation,
      slug,
      description: data.description,
      firstRecompense: Number(data.firstRecompense) || 0,
      secondRecompense: Number(data.secondRecompense) || 0,
      thirdRecompense: Number(data.thirdRecompense) || 0,
      status: true,
    };

    if (data.sessionId) payload.sessionId = new mongoose.Types.ObjectId(data.sessionId);

    const critere = await Critere.create(payload);

    return { success: true, critere: JSON.parse(JSON.stringify(critere)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCritereAction(
  id: string,
  data: {
    status?: boolean;
    firstRecompense?: number;
    secondRecompense?: number;
    thirdRecompense?: number;
    designation?: string;
    description?: string;
  },
) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.designation) update.designation = data.designation;
    if (data.description !== undefined) update.description = data.description;
    if (data.firstRecompense !== undefined) update.firstRecompense = Number(data.firstRecompense);
    if (data.secondRecompense !== undefined) update.secondRecompense = Number(data.secondRecompense);
    if (data.thirdRecompense !== undefined) update.thirdRecompense = Number(data.thirdRecompense);

    const critere = await Critere.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!critere) return { success: false, error: 'Critère introuvable' };

    return { success: true, critere: JSON.parse(JSON.stringify(critere)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCritereAction(id: string) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const critere = await Critere.findByIdAndDelete(id).lean();
    if (!critere) return { success: false, error: 'Critère introuvable' };

    return { success: true, message: 'Critère supprimé.' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── BONUS HEBDOMADAIRE ────────────────────────────────────────────

/**
 * Bonus hebdomadaire (EX-JEU-03) :
 * - STANDALONE : +20 parties dans Player.parties ;
 * - ADVANCED : +30 parties sur chaque enrôlement Parcours confirmé, dans totalGrantedGames ET
 *   remainingGames (les champs réellement lus par le jeu ; maxParties suit pour compatibilité).
 * Idempotent par semaine ISO : une trace BonusRun unique empêche une double application.
 */
export async function applyWeeklyBonusAction() {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();
    const week = isoWeek();

    const result = await withTransaction(async (dbSession) => {
      try {
        await BonusRun.create([{ week, appliedBy: guard.session.userId }], tx(dbSession));
      } catch (error: any) {
        if (error?.code === 11000) return null;
        throw error;
      }

      const standalone = await Player.updateMany(
        { type: 'STANDALONE' },
        { $inc: { parties: WEEKLY_BONUS_STANDALONE } },
        tx(dbSession),
      );

      const advancedIds = await Player.find({ type: 'ADVANCED' }).select('_id').session(dbSession).lean();
      const advanced = await Enrollement.updateMany(
        { playerId: { $in: advancedIds.map((p) => p._id) }, status: 'CONFIRMED', parcoursId: { $exists: true } },
        { $inc: { totalGrantedGames: WEEKLY_BONUS_ADVANCED, remainingGames: WEEKLY_BONUS_ADVANCED, maxParties: WEEKLY_BONUS_ADVANCED } },
        tx(dbSession),
      );

      await BonusRun.updateOne(
        { week },
        { $set: { standaloneCount: standalone.modifiedCount, advancedEnrollmentsCount: advanced.modifiedCount } },
        tx(dbSession),
      );
      return { standalone: standalone.modifiedCount, advanced: advanced.modifiedCount };
    });

    if (!result) {
      return { success: false, error: `Le bonus de la semaine ${week} a déjà été appliqué.` };
    }

    return {
      success: true,
      message: `Bonus ${week} appliqué : ${result.standalone} STANDALONE (+${WEEKLY_BONUS_STANDALONE} parties), ${result.advanced} enrôlement(s) ADVANCED (+${WEEKLY_BONUS_ADVANCED} parties).`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Bonus manuel : délègue à grantPlayerBonusPartiesAction (staff, valeur positive validée).
 */
export async function applyBonusPartiesAction(playerId: string, increment: number = 3) {
  return grantPlayerBonusPartiesAction(playerId, increment);
}

/**
 * Récupère les stats par catégorie (questions OK/NO par catégorie)
 */
export async function getCategoryStatsAction() {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    // EX-JEU-04 : agrégation MongoDB (plus de chargement de toutes les parties en mémoire).
    // Chaque réponse est rattachée à la catégorie de SA question (corrige aussi JEU-13).
    const [categories, answers, bank] = await Promise.all([
      Categorie.find({ status: true }).lean(),
      Partie.aggregate([
        { $match: { status: 'TERMINE' } },
        { $unwind: '$reponses' },
        { $lookup: { from: 'quizzes', localField: 'reponses.quizId', foreignField: '_id', as: 'quiz' } },
        { $unwind: '$quiz' },
        {
          $group: {
            _id: '$quiz.categorieId',
            total: { $sum: 1 },
            ok: { $sum: { $cond: ['$reponses.estCorrecte', 1, 0] } },
          },
        },
      ]),
      // JEU-12 : banque de questions actives par catégorie et par niveau
      Quiz.aggregate([
        { $match: { status: true } },
        { $group: { _id: { categorieId: '$categorieId', level: '$level' }, count: { $sum: 1 } } },
      ]),
    ]);

    const answersByCat = new Map(answers.map((a: any) => [String(a._id), a]));
    const bankByCat = new Map<string, number[]>();
    for (const row of bank as any[]) {
      const key = String(row._id.categorieId);
      const levels = bankByCat.get(key) || [0, 0, 0, 0];
      if (row._id.level >= 0 && row._id.level <= 3) levels[row._id.level] = row.count;
      bankByCat.set(key, levels);
    }

    return {
      success: true,
      categories: categories.map((cat: any) => {
        const stats = answersByCat.get(cat._id.toString()) || { total: 0, ok: 0 };
        const questionsParNiveau = bankByCat.get(cat._id.toString()) || [0, 0, 0, 0];
        const niveauxInsuffisants = questionsParNiveau
          .map((count, level) => ({ count, level }))
          .filter((item) => item.count < MIN_QUESTIONS_PER_LEVEL)
          .map((item) => item.level);
        return {
          label: cat.designation,
          ok: stats.ok,
          no: stats.total - stats.ok,
          total: stats.total,
          percent: stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 0,
          questionsParNiveau,
          niveauxInsuffisants,
        };
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}