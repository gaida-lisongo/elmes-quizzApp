'use server';

import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import Player from '@/lib/models/Player';
import User from '@/lib/models/User';
import Partie from '@/lib/models/Partie';
import Categorie from '@/lib/models/Categorie';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';

const { Enrollement, Session } = EnrollementModule;

const isStaffSession = (session: { role?: string } | null | undefined) =>
  Boolean(session && ['ADMIN', 'MOD'].includes(session.role || ''));

export interface PlayerMetricsData {
  playerType: 'STANDALONE' | 'ADVANCED' | 'VIP';
  stats: {
    partiesJouees: number;
    scoreTotal: number;
    precision: number;
    level: number;
    partiesDisponibles: number;
  };
  averages: {
    questions: { ok: number; total: number; percent: number };
    categories: { ok: number; total: number; percent: number };
    parties: { ok: number; total: number; percent: number };
    balance: { current: number; total: number; percent: number };
    level: { current: number; total: number; percent: number };
  };
  top: {
    label: string;
    value: string;
    detail: string;
    rank: number;
    score: number;
  };
  recentParties: Array<{
    _id: string;
    categorie: string;
    note: number;
    status: string;
    createdAt: string;
  }>;
  categoryBreakdown: Array<{ categorie: string; parties: number; ok: number }>;
  chart: Array<{ label: string; value: number; detail: string }>;
  sessions: Array<{ label: string; count: number }>;
  leaderboard?: Array<{ _id: string; pseudo: string; score: number; parties: number; precision: number; rank: number; level: number }>;
  recharges?: Array<{ _id: string; index: number; amount: number; status: string; targetLevel: number; creditedParties: number; createdAt: string; providerTxId: string; reference?: string }>;
  rewards?: Array<{ _id: string; parcours: string; session: string; rank: number; amount: number; status: string; reference: string; createdAt: string }>;
  team?: {
    _id: string;
    designation: string;
    role: 'CAPTAIN' | 'SECRETARY' | 'MEMBER';
    isCaptain: boolean;
    isSecretary: boolean;
    status: boolean;
    members: Array<{ _id: string; pseudo: string; isSecretary: boolean; status: boolean; isCurrentUser: boolean }>;
    soldeUsd: number;
    purchaseOrders: Array<{ _id: string; beneficiaryPseudo: string; amount: number; reason: string; status: string; createdAt: string; approvedAt?: string; creditedAt?: string; canApprove: boolean }>;
  } | null;
}

const getTrainingPassParties = (amountCDF: number, targetLevel: number) => {
  if (amountCDF === 2500 || targetLevel === 1) return 15;
  if (amountCDF === 7000 || targetLevel === 2) return 40;
  if (amountCDF === 15000 || targetLevel === 3) return 130;
  return 0;
};

async function ensureStaffAccess() {
  const session = await getSession();
  if (!isStaffSession(session)) return null;
  return session;
}

export async function getPlayerMetricsAction(): Promise<{ success: boolean; data?: PlayerMetricsData; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };

    await connectToDb();

    const player = await Player.findOne({ userId: session.userId }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    const [parties, categories, enrolments] = await Promise.all([
      Partie.find({ playerId: player._id }).populate('categorieId', 'designation').sort({ createdAt: -1 }).limit(8).lean(),
      Categorie.find({ status: true }).lean(),
      Enrollement.find({ playerId: player._id }).populate('sessionId', 'designation').lean(),
    ]);

    const totalQuestions = parties.reduce((acc, p: any) => acc + (p.reponses?.length || 0), 0);
    const correctAnswers = parties.reduce((acc, p: any) => acc + (p.reponses?.filter((r: any) => r.estCorrecte).length || 0), 0);

    const categoryMap = new Map<string, { categorie: string; parties: number; ok: number }>();
    for (const cat of categories) {
      categoryMap.set(cat._id.toString(), { categorie: cat.designation, parties: 0, ok: 0 });
    }

    const playedCategories = new Set<string>();
    for (const party of parties) {
      const catId = (party.categorieId as any)?._id?.toString() || party.categorieId?.toString();
      if (catId && categoryMap.has(catId)) {
        const entry = categoryMap.get(catId)!;
        entry.parties += 1;
        entry.ok += party.reponses?.filter((r: any) => r.estCorrecte).length || 0;
        playedCategories.add(catId);
      }
    }

    const categoryBreakdown = Array.from(categoryMap.values())
      .filter((item) => item.parties > 0)
      .map((item) => ({ ...item }));

    const sessions = enrolments
      .filter((entry) => entry.sessionId)
      .map((entry) => ({
        label: (entry.sessionId as any)?.designation || 'Session',
        count: 1,
      }));

    const aggregatedSessions = sessions.reduce((acc: Array<{ label: string; count: number }>, entry) => {
      const existing = acc.find((item) => item.label === entry.label);
      if (existing) existing.count += 1; else acc.push(entry);
      return acc;
    }, []);

    const totalCategories = categories.length;
    const playedCategoriesCount = playedCategories.size;

    const balancedParties = player.parties || 0;
    const partyPercent = balancedParties > 0 ? Math.round((parties.length / balancedParties) * 100) : 0;

    const leaderboard = await Player.find({ type: 'STANDALONE' })
      .populate('userId', 'pseudo')
      .sort({ 'metrics.totalScore': -1, createdAt: 1 })
      .lean();

    const leaderboardRows = leaderboard
      .map((entry: any, index: number) => ({
        _id: entry._id.toString(),
        pseudo: entry.userId?.pseudo || 'Joueur',
        score: entry.metrics?.totalScore || 0,
        parties: entry.metrics?.partiesJouees || 0,
        precision: entry.metrics?.partiesJouees ? Math.round(((entry.metrics?.partiesGagnees || 0) / entry.metrics.partiesJouees) * 100) : 0,
        rank: index + 1,
        level: entry.level || 0,
      }))
      .slice(0, 10);

    const currentRank = leaderboardRows.find((entry) => entry._id === player._id.toString())?.rank || 0;

    let team: PlayerMetricsData['team'] = null;
    if (player.type === 'VIP') {
      const teamDoc = await Equipe.findOne({ membres: { $elemMatch: { player: player._id } } })
        .populate({ path: 'chefId', populate: { path: 'userId', select: 'pseudo photo telephone' } })
        .lean();

      if (teamDoc) {
        const memberDetails = await Promise.all(
          (teamDoc.membres || []).map(async (member: any) => {
            const memberPlayer = await Player.findById(member.player).populate('userId', 'pseudo photo telephone').lean();
            return {
              _id: memberPlayer?._id?.toString() || member.player?.toString(),
              pseudo: (memberPlayer?.userId as any)?.pseudo || 'Membre',
              isSecretary: Boolean(member.isSecretary),
              status: Boolean(member.status),
              isCurrentUser: member.player?.toString() === player._id.toString(),
            };
          })
        );

        const isCaptain = teamDoc.chefId?._id?.toString() === player._id.toString();
        const isSecretary = memberDetails.some((member) => member.isCurrentUser && member.isSecretary);
        const currentMember = memberDetails.find((member) => member.isCurrentUser);
        team = {
          _id: teamDoc._id.toString(),
          designation: teamDoc.designation,
          role: isCaptain ? 'CAPTAIN' : isSecretary ? 'SECRETARY' : 'MEMBER',
          isCaptain,
          isSecretary,
          status: isCaptain || Boolean(currentMember?.status),
          members: memberDetails,
          soldeUsd: teamDoc.metriques?.soldeUsd || 0,
          purchaseOrders: await Promise.all((teamDoc.purchaseOrders || []).map(async (order: any) => {
            const beneficiary = await User.findById(order.beneficiaryUserId).select('pseudo').lean();
            return {
              _id: order._id?.toString?.() || `${order.createdAt?.getTime?.() || Date.now()}`,
              beneficiaryPseudo: beneficiary?.pseudo || 'Membre',
              amount: order.amount || 0,
              reason: order.reason || '',
              status: order.status || 'pending',
              createdAt: order.createdAt?.toISOString?.() || '',
              approvedAt: order.approvedAt?.toISOString?.(),
              creditedAt: order.creditedAt?.toISOString?.(),
              canApprove: isCaptain && order.status === 'pending',
            };
          })),
        };
      }
    }

    const rewardSessions = player.type === 'ADVANCED'
      ? await Session.find({ 'rewardTransactions.beneficiaryType': 'PLAYER', 'rewardTransactions.beneficiaryId': player._id })
          .populate({ path: 'rewardTransactions.enrollmentId', populate: [{ path: 'parcoursId', select: 'designation' }] })
          .sort({ paymentProcessedAt: -1, updatedAt: -1 })
          .lean()
      : [];

    const rewards = rewardSessions.flatMap((sessionDoc: any) =>
      (sessionDoc.rewardTransactions || [])
        .filter((reward: any) => reward.beneficiaryType === 'PLAYER' && reward.beneficiaryId?.toString() === player._id.toString())
        .map((reward: any) => ({
          _id: `${sessionDoc._id}-${reward.enrollmentId?._id || reward.enrollmentId}`,
          parcours: reward.enrollmentId?.parcoursId?.designation || 'Parcours',
          session: sessionDoc.designation || 'Session',
          rank: Number(String(reward.reason || '').replace('PARCOURS_TOP_', '')) || 0,
          amount: reward.amount || 0,
          status: sessionDoc.rewardsDistributed ? 'créditée' : 'en attente',
          reference: reward.reason || '',
          createdAt: reward.createdAt?.toISOString?.() || sessionDoc.paymentProcessedAt?.toISOString?.() || '',
        }))
    );

    return {
      success: true,
      data: {
        playerType: player.type,
        stats: {
          partiesJouees: parties.length,
          scoreTotal: player.metrics?.totalScore || 0,
          precision: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
          level: player.level || 0,
          partiesDisponibles: player.parties || 0,
        },
        averages: {
          questions: {
            ok: correctAnswers,
            total: totalQuestions,
            percent: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
          },
          categories: {
            ok: playedCategoriesCount,
            total: totalCategories,
            percent: totalCategories > 0 ? Math.round((playedCategoriesCount / totalCategories) * 100) : 0,
          },
          parties: {
            ok: parties.length,
            total: balancedParties || 0,
            percent: partyPercent,
          },
          balance: {
            current: balancedParties || 0,
            total: Math.max(3, balancedParties || 0),
            percent: balancedParties > 0 ? Math.round((balancedParties / Math.max(3, balancedParties)) * 100) : 0,
          },
          level: {
            current: player.level || 0,
            total: 3,
            percent: Math.round(((player.level || 0) / 3) * 100),
          },
        },
        top: {
          label: 'Classement',
          value: currentRank > 0 ? `#${currentRank}` : '—',
          detail: currentRank > 0 ? `${player.metrics?.totalScore || 0} pts cum. ` : 'Pas encore classé',
          rank: currentRank,
          score: player.metrics?.totalScore || 0,
        },
        recentParties: parties.map((party: any) => ({
          _id: party._id.toString(),
          categorie: (party.categorieId as any)?.designation || 'Catégorie',
          note: party.note || 0,
          status: party.status,
          createdAt: party.createdAt?.toISOString?.() || '',
        })),
        categoryBreakdown,
        chart: (player.type === 'ADVANCED' ? aggregatedSessions : categoryBreakdown).map((item: any) => ({
          label: item.categorie || item.label,
          value: item.parties || item.count || 0,
          detail: item.ok ? `${item.ok} OK` : item.count ? `${item.count} inscr.` : 'Aucune donnée',
        })),
        sessions: aggregatedSessions,
        leaderboard: leaderboardRows,
        recharges: (player.recharges || []).map((recharge: any, index: number) => ({
          _id: recharge.providerTxId || `${recharge.amount}-${recharge.createdAt}`,
          index,
          amount: recharge.amount || 0,
          status: recharge.status || 'EN_ATTENTE',
          targetLevel: recharge.targetLevel || 0,
          creditedParties: getTrainingPassParties(recharge.amount || 0, recharge.targetLevel || 0),
          createdAt: recharge.createdAt?.toISOString?.() || '',
          providerTxId: recharge.providerTxId || '',
          reference: recharge.reference || '',
        })),
        rewards,
        team,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function searchModeratorPlayersAction(query: string): Promise<{
  success: boolean;
  players?: Array<{
    _id: string;
    pseudo: string;
    telephone: string;
    email?: string;
    type: string;
    level: number;
    statut: string;
    parties: number;
    score: number;
    playerId: string;
  }>;
  error?: string;
}> {
  try {
    const session = await ensureStaffAccess();
    if (!session) return { success: false, error: 'Non autorisé' };

    const search = query.trim();
    if (search.length < 2) return { success: true, players: [] };

    await connectToDb();
    const regex = new RegExp(search, 'i');
    const objectId = mongoose.isValidObjectId(search) ? new mongoose.Types.ObjectId(search) : null;
    const numericLevel = Number(search);
    const levelMatch = Number.isInteger(numericLevel) ? [{ level: numericLevel }] : [];

    const players = await Player.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $match: {
          $or: [
            { 'user.pseudo': regex },
            { 'user.telephone': regex },
            { 'user.email': regex },
            { type: regex },
            { statut: regex },
            ...levelMatch,
            ...(objectId ? [{ _id: objectId }, { userId: objectId }] : []),
          ],
        },
      },
      {
        $project: {
          _id: 1,
          pseudo: '$user.pseudo',
          telephone: '$user.telephone',
          email: '$user.email',
          type: 1,
          level: 1,
          statut: 1,
          parties: 1,
          score: '$metrics.totalScore',
          createdAt: 1,
          playerId: { $toString: '$_id' },
        },
      },
      { $sort: { score: -1, createdAt: -1 } },
      { $limit: 20 },
    ]);

    return { success: true, players: JSON.parse(JSON.stringify(players)) };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de recherche.' };
  }
}

export async function getModeratorPlayerDetailAction(playerId: string): Promise<{
  success: boolean;
  data?: {
    profile: {
      _id: string;
      pseudo: string;
      telephone: string;
      email?: string;
      photo?: string;
      type: string;
      level: number;
      statut: string;
      parties: number;
      score: number;
    };
    games: Array<{
      _id: string;
      category: string;
      score: number;
      status: string;
      mode: string;
      session: string;
      createdAt: string;
    }>;
    enrollments: Array<{
      _id: string;
      session: string;
      resource: string;
      status: string;
      points: number;
      remainingGames: number;
    }>;
  };
  error?: string;
}> {
  try {
    const session = await ensureStaffAccess();
    if (!session) return { success: false, error: 'Non autorisé' };

    await connectToDb();
    const player = await Player.findById(playerId)
      .populate('userId', 'pseudo telephone email photo role')
      .lean();
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    const [games, enrollments] = await Promise.all([
      Partie.find({ playerId: player._id })
        .populate('categorieId', 'designation')
        .populate('sessionId', 'designation status type')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      Enrollement.find({ playerId: player._id })
        .populate('sessionId', 'designation status type')
        .populate('parcoursId', 'designation')
        .populate('competitionId', 'designation')
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      success: true,
      data: {
        profile: {
          _id: player._id.toString(),
          pseudo: (player.userId as any)?.pseudo || 'Joueur',
          telephone: (player.userId as any)?.telephone || '',
          email: (player.userId as any)?.email || '',
          photo: (player.userId as any)?.photo || '',
          type: player.type,
          level: player.level || 0,
          statut: player.statut || 'ELEVE',
          parties: player.parties || 0,
          score: player.metrics?.totalScore || 0,
        },
        games: JSON.parse(JSON.stringify((games || []).map((game: any) => ({
          _id: game._id.toString(),
          category: game.categorieId?.designation || 'Catégorie',
          score: game.note || 0,
          status: game.status || 'UNKNOWN',
          mode: game.mode || 'STANDARD',
          session: game.sessionId?.designation || '',
          createdAt: game.createdAt?.toISOString?.() || '',
        })))),
        enrollments: JSON.parse(JSON.stringify((enrollments || []).map((enrollment: any) => ({
          _id: enrollment._id.toString(),
          session: enrollment.sessionId?.designation || 'Session',
          resource: enrollment.parcoursId?.designation || enrollment.competitionId?.designation || 'Ressource',
          status: enrollment.status || 'PENDING',
          points: enrollment.points || 0,
          remainingGames: enrollment.remainingGames || 0,
        })))),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de chargement.' };
  }
}

export async function updatePlayerLevelAction(playerId: string, nextLevel: number): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await ensureStaffAccess();
    if (!session) return { success: false, error: 'Non autorisé' };

    const allowedLevels = [0, 1, 2, 3];
    const numericLevel = Number(nextLevel);
    if (!Number.isInteger(numericLevel) || !allowedLevels.includes(numericLevel)) {
      return { success: false, error: 'Niveau invalide.' };
    }

    await connectToDb();
    const player = await Player.findByIdAndUpdate(
      playerId,
      { $set: { level: numericLevel } },
      { new: true },
    ).lean();
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    return { success: true, message: 'Niveau mis à jour.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de mise à jour.' };
  }
}

export async function grantPlayerBonusPartiesAction(playerId: string, bonusCount: number, reason?: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await ensureStaffAccess();
    if (!session) return { success: false, error: 'Non autorisé' };

    const numericBonus = Number(bonusCount);
    if (!Number.isInteger(numericBonus) || numericBonus <= 0) {
      return { success: false, error: 'Le nombre de bonus doit être positif.' };
    }

    await connectToDb();
    const player = await Player.findById(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    player.parties = (player.parties || 0) + numericBonus;
    await player.save();

    // TODO: tracer l'attribution dans un modèle d'audit ou de transaction si l'application en expose un.
    return {
      success: true,
      message: reason?.trim()
        ? `${numericBonus} partie(s) ajoutée(s) - ${reason.trim()}`
        : `${numericBonus} partie(s) ajoutée(s)`,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'attribution.' };
  }
}
