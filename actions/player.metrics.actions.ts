'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import Player from '@/lib/models/Player';
import User from '@/lib/models/User';
import Partie from '@/lib/models/Partie';
import Categorie from '@/lib/models/Categorie';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';

const { Enrollement } = EnrollementModule;

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
  recharges?: Array<{ _id: string; amount: number; status: string; targetLevel: number; createdAt: string; providerTxId: string }>;
  team?: {
    _id: string;
    designation: string;
    role: 'CAPTAIN' | 'SECRETARY' | 'MEMBER';
    isCaptain: boolean;
    isSecretary: boolean;
    status: boolean;
    members: Array<{ _id: string; pseudo: string; isSecretary: boolean; status: boolean; isCurrentUser: boolean }>;
  } | null;
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
        };
      }
    }

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
        recharges: (player.recharges || []).map((recharge: any) => ({
          _id: recharge.providerTxId || `${recharge.amount}-${recharge.createdAt}`,
          amount: recharge.amount || 0,
          status: recharge.status || 'EN_ATTENTE',
          targetLevel: recharge.targetLevel || 0,
          createdAt: recharge.createdAt?.toISOString?.() || '',
          providerTxId: recharge.providerTxId || '',
        })),
        team,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
