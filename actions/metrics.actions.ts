'use server';

import mongoose from 'mongoose';
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";
import Equipe from "@/lib/models/Equipe";
import EnrollementModule from "@/lib/models/Enrollement";

const { Enrollement } = EnrollementModule;
const { Session } = EnrollementModule;

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

export interface SessionRevenueDistributionRow {
  resourceId: string;
  resourceTitle: string;
  resourceType: 'parcours' | 'competition' | 'unknown';
  amount: number;
  countPayments: number;
  countEnrollments: number;
}

export interface SessionRevenueOverviewRow {
  sessionId: string;
  name: string;
  type: 'parcours' | 'competition' | 'unknown';
  status: string;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalEnrollments: number;
  validatedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  distribution: SessionRevenueDistributionRow[];
}

const VALID_PAYMENT_STATUSES = new Set(['PAID', 'SUCCES']);
const PENDING_PAYMENT_STATUSES = new Set(['PENDING', 'EN_ATTENTE']);
const FAILED_PAYMENT_STATUSES = new Set(['FAILED', 'ECHEC']);

const resolveSessionType = (session: any): 'parcours' | 'competition' | 'unknown' => {
  if (session?.type === 'parcours' || session?.type === 'competition') return session.type;
  const hasCompetition = (session?.ressources || []).some((item: any) => item.type === 'Competition');
  const hasParcours = (session?.ressources || []).some((item: any) => item.type === 'Parcours');
  if (hasCompetition) return 'competition';
  if (hasParcours) return 'parcours';
  return 'unknown';
};

async function buildSessionRevenueRow(sessionDoc: any): Promise<SessionRevenueOverviewRow> {
  const enrollments = await Enrollement.find({ sessionId: sessionDoc._id })
    .populate('parcoursId', 'designation slug')
    .populate('competitionId', 'designation slug')
    .lean();

  const distribution = new Map<string, SessionRevenueDistributionRow>();
  let totalRevenue = 0;
  let totalEnrollments = 0;
  let validatedPayments = 0;
  let pendingPayments = 0;
  let failedPayments = 0;

  for (const enrollment of enrollments as any[]) {
    totalEnrollments += 1;
    const paidPayments = (enrollment.transactions || []).filter((transaction: any) => VALID_PAYMENT_STATUSES.has(transaction.status));
    const pendingCount = (enrollment.transactions || []).filter((transaction: any) => PENDING_PAYMENT_STATUSES.has(transaction.status)).length;
    const failedCount = (enrollment.transactions || []).filter((transaction: any) => FAILED_PAYMENT_STATUSES.has(transaction.status)).length;

    const resourceType = enrollment.competitionId
      ? 'competition'
      : enrollment.parcoursId
        ? 'parcours'
        : 'unknown';
    const resourceId = enrollment.competitionId?._id?.toString?.()
      || enrollment.parcoursId?._id?.toString?.()
      || enrollment._id.toString();
    const resourceTitle = enrollment.competitionId?.designation
      || enrollment.parcoursId?.designation
      || sessionDoc.designation
      || 'Ressource';

    const amount = paidPayments.reduce((sum: number, transaction: any) => sum + Number(transaction.montant || 0), 0);
    totalRevenue += amount;
    validatedPayments += paidPayments.length;
    pendingPayments += pendingCount;
    failedPayments += failedCount;

    const key = `${resourceType}:${resourceId}`;
    const current = distribution.get(key) || {
      resourceId,
      resourceTitle,
      resourceType,
      amount: 0,
      countPayments: 0,
      countEnrollments: 0,
    };

    current.amount += amount;
    current.countPayments += paidPayments.length;
    current.countEnrollments += 1;
    distribution.set(key, current);
  }

  return {
    sessionId: sessionDoc._id.toString(),
    name: sessionDoc.designation || 'Session',
    type: resolveSessionType(sessionDoc),
    status: sessionDoc.status || 'ACTIVE',
    startDate: sessionDoc.startDate?.toISOString?.() || '',
    endDate: sessionDoc.endDate?.toISOString?.() || '',
    totalRevenue,
    totalEnrollments,
    validatedPayments,
    pendingPayments,
    failedPayments,
    distribution: Array.from(distribution.values()).sort((a, b) => b.amount - a.amount),
  };
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

export async function getSessionRevenueOverviewAction(sessionId?: string): Promise<{
  success: boolean;
  data?: {
    sessions: SessionRevenueOverviewRow[];
    selectedSessionId: string | null;
    selectedSession: SessionRevenueOverviewRow | null;
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }

    await connectToDb();

    const sessions = await Session.find({})
      .populate('ressources.refId', 'designation slug amount cagnotte')
      .sort({ startDate: -1, createdAt: -1 })
      .limit(8)
      .lean();

    const rows: SessionRevenueOverviewRow[] = [];
    for (const sessionDoc of sessions as any[]) {
      rows.push(await buildSessionRevenueRow(sessionDoc));
    }

    const selectedSession = sessionId
      ? rows.find((item) => item.sessionId === sessionId) || rows[0] || null
      : rows[0] || null;

    return {
      success: true,
      data: {
        sessions: rows,
        selectedSessionId: selectedSession?.sessionId || null,
        selectedSession,
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
