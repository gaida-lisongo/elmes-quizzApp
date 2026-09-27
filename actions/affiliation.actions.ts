'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import Player from '@/lib/models/Player';
import User from '@/lib/models/User';
import Categorie from '@/lib/models/Categorie';
import mongoose from 'mongoose';
import { generateReferralCode } from '@/lib/utils/referral';
import { tx } from '@/lib/utils/transaction';
import { GameError, NB_QUESTIONS, createPartie, resumeOrExpirePartie, tirerQuestions } from '@/lib/services/partie.service';

const AFFILIATE_GAMES_PER_VALID_USER = 10;

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

    const { player } = current;

    // Reprise d'une partie encore valide, ou clôture en échec d'une partie expirée (D-01).
    const { resumed } = await resumeOrExpirePartie(player._id);
    if (resumed) return { success: true, resumed: true, data: resumed };

    if (typeof categorieId !== 'string' || !mongoose.Types.ObjectId.isValid(categorieId)) {
      return { success: false, error: 'Catégorie invalide.' };
    }

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

    const questions = await tirerQuestions([categorieId], player.level || 0, NB_QUESTIONS.AFFILIATION);
    const data = await createPartie({
      player,
      mode: 'AFFILIATION',
      gameSource: 'affiliation',
      categorieIds: [categorieId],
      questions,
      // Décompte atomique au lancement, dans la transaction de création de la partie.
      consume: async (dbSession) => {
        const consumed = await Player.findOneAndUpdate(
          {
            _id: player._id,
            $expr: { $lt: [{ $ifNull: ['$usedAffiliateGames', 0] }, totalGrantedAffiliateGames] },
          },
          { $inc: { usedAffiliateGames: 1 } },
          { new: true, ...tx(dbSession) },
        ).lean();
        return consumed ? Math.max(0, totalGrantedAffiliateGames - (consumed.usedAffiliateGames || 0)) : null;
      },
    });

    return { success: true, resumed: false, data };
  } catch (error: any) {
    if (error instanceof GameError) return { success: false, error: error.message };
    return { success: false, error: error.message || "Erreur lors du lancement de la partie d'affiliation." };
  }
}
