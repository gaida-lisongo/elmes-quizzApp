'use server';

import mongoose from 'mongoose';
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";
import User from "@/lib/models/User";
import Equipe from "@/lib/models/Equipe";
import EnrollementModule from "@/lib/models/Enrollement";
import { Competition } from "@/lib/models/Competition";

const { Enrollement } = EnrollementModule;

/* ================================================================
   Types exportés
   ================================================================ */
export interface MetricMoyennes {
  standalone: { count: number; total: number; percent: number };
  advanced: { count: number; total: number; percent: number };
  vip: { count: number; total: number; percent: number };
  equipesOk: { count: number; total: number; percent: number };
}

export interface ChartCategorie {
  categorie: string;
  ok: number;
  no: number;
  total: number;
}

export interface TopEnrollement {
  categorie: string;
  count: number;
  revenue: number;
}

export interface PlayerRow {
  _id: string;
  pseudo: string;
  telephone: string;
  type: string;
  level: number;
  totalScore: number;
  partiesJouees: number;
  partiesGagnees: number;
}

export interface EquipeRow {
  _id: string;
  designation: string;
  chefPseudo: string;
  membresCount: number;
  paymentStatus: string;
  matchsWin: number;
  soldeUsd: number;
}

export interface MetricsAgentData {
  moyennes: MetricMoyennes;
  chart: ChartCategorie[];
  topEnrollements: TopEnrollement[];
  players: PlayerRow[];
  totalPlayers: number;
  equipes: EquipeRow[];
  totalEquipes: number;
}

/* ================================================================
   Métriques Agent (ADMIN/MOD)
   ================================================================ */
export async function getMetricsAgentAction(): Promise<{ success: boolean; data?: MetricsAgentData; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: 'Non connecté' };

    await connectToDb();

    // ── Moyennes ──────────────────────────────────────────────
    const totalPlayers = await Player.countDocuments();
    const [standalone, advanced, vip] = await Promise.all([
      Player.countDocuments({ type: 'STANDALONE' }),
      Player.countDocuments({ type: 'ADVANCED' }),
      Player.countDocuments({ type: 'VIP' }),
    ]);

    const totalEquipes = await Equipe.countDocuments();
    const equipesOk = await Equipe.countDocuments({
      'payment': { $elemMatch: { status: 'SUCCES' } },
    });

    const moyennes: MetricMoyennes = {
      standalone: {
        count: standalone, total: totalPlayers,
        percent: totalPlayers > 0 ? Math.round((standalone / totalPlayers) * 100) : 0,
      },
      advanced: {
        count: advanced, total: totalPlayers,
        percent: totalPlayers > 0 ? Math.round((advanced / totalPlayers) * 100) : 0,
      },
      vip: {
        count: vip, total: totalPlayers,
        percent: totalPlayers > 0 ? Math.round((vip / totalPlayers) * 100) : 0,
      },
      equipesOk: {
        count: equipesOk, total: totalEquipes,
        percent: totalEquipes > 0 ? Math.round((equipesOk / totalEquipes) * 100) : 0,
      },
    };

    // ── Chart: Parties par catégorie ──────────────────────────
    const categories = await Categorie.find({ status: true }).lean();
    const partiesTerminees = await Partie.find({ status: 'TERMINE' })
      .populate('categorieId', 'designation')
      .lean();

    const chartMap = new Map<string, { ok: number; no: number }>();
    for (const cat of categories) {
      chartMap.set(cat._id.toString(), { ok: 0, no: 0 });
    }

    for (const p of partiesTerminees) {
      const catId = (p.categorieId as any)?._id?.toString() || p.categorieId?.toString();
      if (catId && chartMap.has(catId)) {
        const entry = chartMap.get(catId)!;
        const totalReponses = p.reponses.length;
        const bonnes = p.reponses.filter(r => r.estCorrecte).length;
        entry.ok += bonnes;
        entry.no += (totalReponses - bonnes);
      }
    }

    const chart: ChartCategorie[] = Array.from(chartMap.entries()).map(([id, val]) => {
      const cat = categories.find(c => c._id.toString() === id);
      return {
        categorie: cat?.designation || 'Inconnue',
        ok: val.ok,
        no: val.no,
        total: val.ok + val.no,
      };
    });

    // ── Top enrollements par montant ─────────────────────────
    const enrollements = await Enrollement.find({ status: 'CONFIRMED' })
      .populate('competitionId', 'amount designation')
      .populate('parcoursId', 'designation')
      .lean();

    const catRevenue = new Map<string, { count: number; revenue: number }>();
    for (const enr of enrollements) {
      const designation = (enr.competitionId as any)?.designation || (enr.parcoursId as any)?.designation || 'Général';
      const amount = (enr.competitionId as any)?.amount || 0;
      if (!catRevenue.has(designation)) {
        catRevenue.set(designation, { count: 0, revenue: 0 });
      }
      const entry = catRevenue.get(designation)!;
      entry.count += 1;
      entry.revenue += amount;
    }

    const topEnrollements: TopEnrollement[] = Array.from(catRevenue.entries())
      .map(([categorie, val]) => ({ categorie, count: val.count, revenue: val.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // ── Joueurs paginés (MOD) ─────────────────────────────────
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
        $project: {
          _id: 1,
          pseudo: '$user.pseudo',
          telephone: '$user.telephone',
          type: 1,
          level: 1,
          totalScore: '$metrics.totalScore',
          partiesJouees: '$metrics.partiesJouees',
          partiesGagnees: '$metrics.partiesGagnees',
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: 10 },
    ]);

    // ── Équipes (ADMIN) ──────────────────────────────────────
    const equipes = await Equipe.aggregate([
      {
        $lookup: {
          from: 'players',
          localField: 'chefId',
          foreignField: '_id',
          as: 'chef',
        },
      },
      { $unwind: { path: '$chef', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'chef.userId',
          foreignField: '_id',
          as: 'chefUser',
        },
      },
      { $unwind: { path: '$chefUser', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          designation: 1,
          chefPseudo: { $ifNull: ['$chefUser.pseudo', '—'] },
          membresCount: { $size: { $ifNull: ['$membres', []] } },
          paymentStatus: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$payment', []] } }, 0] },
              then: { $arrayElemAt: ['$payment.status', -1] },
              else: 'NONE',
            },
          },
          matchsWin: '$metriques.matchsWin',
          soldeUsd: '$metriques.soldeUsd',
        },
      },
      { $sort: { matchsWin: -1 } },
    ]);

    return {
      success: true,
      data: {
        moyennes,
        chart,
        topEnrollements,
        players: JSON.parse(JSON.stringify(players)),
        totalPlayers,
        equipes: JSON.parse(JSON.stringify(equipes)),
        totalEquipes,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ================================================================
   Ancienne fonction (conservée)
   ================================================================ */
export async function getMetricsCounts() {
  try {
    await connectToDb();

    const [categoriesCount, quizzesCount, partiesCount] = await Promise.all([
      Categorie.countDocuments({ status: true }),
      Quiz.countDocuments({ status: true }),
      Partie.countDocuments({ status: 'TERMINE' }),
    ]);

    return {
      categories: categoriesCount,
      quizzes: quizzesCount,
      parties: partiesCount,
    };
  } catch (error) {
    console.error('Erreur lors du chargement des métriques:', error);
    return { categories: 0, quizzes: 0, parties: 0 };
  }
}