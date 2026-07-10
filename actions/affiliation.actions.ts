'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import Player from '@/lib/models/Player';
import User from '@/lib/models/User';
import Partie from '@/lib/models/Partie';
import Categorie from '@/lib/models/Categorie';
import Quiz from '@/lib/models/Quiz';
import mongoose from 'mongoose';
import { generateReferralCode } from '@/lib/utils/referral';
import type { PartieActiveData, QuestionJeu } from '@/actions/partie.actions';

const AFFILIATE_GAMES_PER_VALID_USER = 10;
const AFFILIATE_QUESTIONS_PER_GAME = 3;
const TEMPS_PAR_QUESTION = 15_000;

async function ensureUniquePlayerCode(player: any, pseudo: string) {
  if (player.code?.trim()) return player.code.trim().toUpperCase();

  let code = generateReferralCode(pseudo || 'ELMES');
  let suffix = 0;
  while (await Player.exists({ code, _id: { $ne: player._id } })) {
    suffix += 1;
    code = `${generateReferralCode(pseudo || 'ELMES')}${suffix}`;
  }

  player.code = code;
  await player.save();
  return code;
}

async function getCurrentPlayerWithUser() {
  const session = await getSession();
  if (!session) return { error: 'Non connecté.' };

  await connectToDb();
  const user = await User.findById(session.userId).lean();
  if (!user) return { error: 'Utilisateur introuvable.' };

  const player = await Player.findOne({ userId: session.userId });
  if (!player) return { error: 'Profil joueur introuvable.' };

  return { session, user, player };
}

export async function getMyAffiliationMetricsAction() {
  try {
    const current = await getCurrentPlayerWithUser();
    if ('error' in current) return { success: false, error: current.error };

    const { player, user } = current;
    const code = await ensureUniquePlayerCode(player, user.pseudo);

    const affiliates = await Player.find({
      referedBy: player._id,
      _id: { $ne: player._id },
    })
      .populate('userId', 'pseudo createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const validAffiliatesCount = affiliates.length;
    const totalGrantedAffiliateGames = validAffiliatesCount * AFFILIATE_GAMES_PER_VALID_USER;
    const usedAffiliateGames = Math.max(0, player.usedAffiliateGames || 0);
    const remainingAffiliateGames = Math.max(0, totalGrantedAffiliateGames - usedAffiliateGames);

    return {
      success: true,
      data: {
        code,
        referralCode: code,
        linkPath: `/auth/signup?code=${encodeURIComponent(code)}`,
        validAffiliatesCount,
        totalGrantedAffiliateGames,
        usedAffiliateGames,
        remainingAffiliateGames,
        affiliates: affiliates.map((affiliate: any) => ({
          id: affiliate._id.toString(),
          pseudo: affiliate.userId?.pseudo || 'Joueur',
          createdAt: affiliate.createdAt,
          status: 'valid',
        })),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur affiliation.' };
  }
}

export async function accessAffiliationByCodeAction(code: string) {
  try {
    const current = await getCurrentPlayerWithUser();
    if ('error' in current) return { success: false, error: current.error };

    const normalizedCode = code?.trim().toUpperCase();
    if (!normalizedCode) return { success: false, error: "Code d'affiliation requis." };

    const owner = await Player.findOne({ code: normalizedCode }).select('_id userId code').lean();
    if (!owner) return { success: false, error: "Ce code d'affiliation est introuvable." };

    if (owner._id.toString() !== current.player._id.toString()) {
      return {
        success: false,
        error: "Accès refusé. Ce code appartient à un autre joueur.",
      };
    }

    return { success: true, redirectTo: '/dashboard?tab=affiliation' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur affiliation.' };
  }
}

export async function startAffiliateTrainingPartieAction(categorieId: string) {
  try {
    const current = await getCurrentPlayerWithUser();
    if ('error' in current) return { success: false, error: current.error };

    if (!mongoose.Types.ObjectId.isValid(categorieId)) {
      return { success: false, error: 'Catégorie invalide.' };
    }

    const { player } = current;
    const validAffiliatesCount = await Player.countDocuments({
      referedBy: player._id,
      _id: { $ne: player._id },
    });
    const totalGrantedAffiliateGames = validAffiliatesCount * AFFILIATE_GAMES_PER_VALID_USER;
    const usedAffiliateGames = Math.max(0, player.usedAffiliateGames || 0);
    const remainingAffiliateGames = Math.max(0, totalGrantedAffiliateGames - usedAffiliateGames);

    if (remainingAffiliateGames <= 0) {
      return { success: false, error: "Vous n'avez plus de parties d'affiliation disponibles." };
    }

    const categorie = await Categorie.findOne({ _id: categorieId, status: true }).lean();
    if (!categorie) return { success: false, error: 'Catégorie introuvable ou inactive.' };

    const existing = await Partie.findOne({ playerId: player._id, status: 'EN_COURS' }).lean();
    if (existing) {
      return { success: false, error: 'Vous avez déjà une partie en cours.' };
    }

    // Ne tirer que les questions du niveau exact du joueur
    const quizLevel = Math.max(0, Math.min(3, player.level || 0));
    const questions = await Quiz.aggregate([
      {
        $match: {
          categorieId: new mongoose.Types.ObjectId(categorieId),
          level: quizLevel,
          status: true,
        },
      },
      { $sample: { size: AFFILIATE_QUESTIONS_PER_GAME } },
    ]);

    if (questions.length === 0) {
      return { success: false, error: 'Aucune question disponible pour cette catégorie à votre niveau.' };
    }

    const consumed = await Player.findOneAndUpdate(
      {
        _id: player._id,
        $expr: { $lt: [{ $ifNull: ['$usedAffiliateGames', 0] }, totalGrantedAffiliateGames] },
      },
      { $inc: { usedAffiliateGames: 1 } },
      { new: true },
    ).lean();

    if (!consumed) {
      return { success: false, error: "Aucune partie d'affiliation restante." };
    }

    const partie = await Partie.create({
      playerId: player._id,
      categorieId: new mongoose.Types.ObjectId(categorieId),
      mode: 'AFFILIATION',
      gameSource: 'affiliation',
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
        mode: 'AFFILIATION',
        parties: Math.max(0, totalGrantedAffiliateGames - (consumed.usedAffiliateGames || 0)),
      } as PartieActiveData,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors du lancement de la partie d'affiliation." };
  }
}
