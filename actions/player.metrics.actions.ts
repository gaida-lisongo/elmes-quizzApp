'use server';

import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
import Player from '@/lib/models/Player';
import Partie from '@/lib/models/Partie';
import Categorie from '@/lib/models/Categorie';
import EnrollementModule from '@/lib/models/Enrollement';
import Equipe from '@/lib/models/Equipe';

const { Enrollement } = EnrollementModule;

export interface PlayerMetricsData {
  stats: {
    partiesJouees: number;
    scoreTotal: number;
    precision: number;
    level: number;
    partiesDisponibles: number;
  };
  recentParties: Array<{
    _id: string;
    categorie: string;
    note: number;
    status: string;
    createdAt: string;
  }>;
  categoryBreakdown: Array<{ categorie: string; parties: number; ok: number }>;
  sessions: Array<{ label: string; count: number }>;
  team?: { designation: string; members: number } | null;
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

    const totalQuestions = parties.reduce((acc, p) => acc + (p.reponses?.length || 0), 0);
    const correctAnswers = parties.reduce((acc, p) => acc + (p.reponses?.filter((r: any) => r.estCorrecte).length || 0), 0);

    const categoryMap = new Map<string, { categorie: string; parties: number; ok: number }>();
    for (const cat of categories) {
      categoryMap.set(cat._id.toString(), { categorie: cat.designation, parties: 0, ok: 0 });
    }

    for (const party of parties) {
      const catId = (party.categorieId as any)?._id?.toString() || party.categorieId?.toString();
      if (catId && categoryMap.has(catId)) {
        const entry = categoryMap.get(catId)!;
        entry.parties += 1;
        entry.ok += party.reponses?.filter((r: any) => r.estCorrecte).length || 0;
      }
    }

    const categoryBreakdown = Array.from(categoryMap.values()).filter((item) => item.parties > 0);

    const sessions = enrolments
      .filter((entry) => entry.sessionId)
      .map((entry) => ({
        label: (entry.sessionId as any)?.designation || 'Session',
        count: 1,
      }));

    const team = player.type === 'VIP'
      ? await Equipe.findOne({ membres: { $elemMatch: { player: player._id } } }).populate('chefId', 'userId').lean()
      : null;

    return {
      success: true,
      data: {
        stats: {
          partiesJouees: parties.length,
          scoreTotal: player.metrics?.totalScore || 0,
          precision: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
          level: player.level || 0,
          partiesDisponibles: player.parties || 0,
        },
        recentParties: parties.map((party) => ({
          _id: party._id.toString(),
          categorie: (party.categorieId as any)?.designation || 'Catégorie',
          note: party.note || 0,
          status: party.status,
          createdAt: party.createdAt?.toISOString?.() || '',
        })),
        categoryBreakdown,
        sessions: sessions.reduce((acc: Array<{ label: string; count: number }>, entry) => {
          const existing = acc.find((item) => item.label === entry.label);
          if (existing) existing.count += 1; else acc.push(entry);
          return acc;
        }, []),
        team: team ? { designation: (team as any).designation, members: (team as any).membres?.length || 0 } : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
