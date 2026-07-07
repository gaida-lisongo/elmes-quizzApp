'use server';

import connectToDb from '@/lib/utils/db';
import { getSession } from '@/lib/utils/auth';
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
  firstPoints: number;
  secondPoints: number;
  thirdPoints: number;
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
      firstPoints: data.firstPoints,
      firstRecompense: Number(data.firstRecompense),
      secondPoints: data.secondPoints,
      secondRecompense: Number(data.secondRecompense),
      thirdPoints: data.thirdPoints,
      thirdRecompense: Number(data.thirdRecompense),
      first: [],
      second: [],
      third: [],
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
    firstPoints?: number;
    firstRecompense?: number;
    secondPoints?: number;
    secondRecompense?: number;
    thirdPoints?: number;
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
    if (data.firstPoints !== undefined) update.firstPoints = data.firstPoints;
    if (data.firstRecompense !== undefined) update.firstRecompense = Number(data.firstRecompense);
    if (data.secondPoints !== undefined) update.secondPoints = data.secondPoints;
    if (data.secondRecompense !== undefined) update.secondRecompense = Number(data.secondRecompense);
    if (data.thirdPoints !== undefined) update.thirdPoints = data.thirdPoints;
    if (data.thirdRecompense !== undefined) update.thirdRecompense = Number(data.thirdRecompense);

    const critere = await Critere.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!critere) return { success: false, error: 'Critère introuvable' };

    return { success: true, critere: JSON.parse(JSON.stringify(critere)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── CLASSEMENT AUTO (qualification) ───────────────────────────────

/**
 * Vérifie pour un critère donné si des enrollements atteignent les paliers.
 * Utilise les points firstPoints/secondPoints/thirdPoints du critère.
 * Fonctionne avec enrollements filtrés par sessionId.
 */
export async function checkCriteresClassementAction(critereId: string) {
  try {
    await connectToDb();

    const critere = await Critere.findById(critereId).lean();
    if (!critere) return { success: false, error: 'Critère introuvable' };
    if (!critere.status) return { success: false, error: 'Critère inactif' };

    const { thirdPoints, secondPoints, firstPoints } = critere;

    // Récupérer les enrollements pour cette session
    const match: any = { status: 'CONFIRMED' };
    if (critere.sessionId) match.sessionId = critere.sessionId;
    else return { success: false, error: 'Aucune session associée' };

    // 1. Palier third (6 places)
    const alreadyThird = (critere.third || []).filter(e => e.playerId || e.equipeId).length;
    if (alreadyThird < 6) {
      const qualifiables = await Enrollement.aggregate([
        { $match: { ...match, points: { $gte: thirdPoints } } },
        { $sort: { points: -1 } },
        { $limit: 6 - alreadyThird },
        { $project: { _id: 1, equipeId: 1, playerId: 1, points: 1 } },
      ]);

      for (const entry of qualifiables) {
        await Critere.findByIdAndUpdate(critereId, {
          $push: {
            third: {
              ...(entry.equipeId ? { equipeId: entry.equipeId } : {}),
              ...(entry.playerId ? { playerId: entry.playerId } : {}),
              createdAt: new Date(),
            },
          },
        });
      }
    }

    // 2. Palier second (4 places)
    const alreadySecond = (critere.second || []).filter(e => e.playerId || e.equipeId).length;
    if (alreadySecond < 4) {
      const thirdEntries = await Critere.findById(critereId).lean();
      const thirdIds = (thirdEntries?.third || [])
        .filter(e => e.playerId || e.equipeId)
        .map(e => (e.playerId || e.equipeId)!);
      
      if (thirdIds.length > 0) {
        const qualifiables = await Enrollement.aggregate([
          { $match: { ...match, points: { $gte: secondPoints }, $or: [{ playerId: { $in: thirdIds } }, { equipeId: { $in: thirdIds } }] } },
          { $sort: { points: -1 } },
          { $limit: Math.min(4 - alreadySecond, thirdIds.length) },
          { $project: { _id: 1, equipeId: 1, playerId: 1, points: 1 } },
        ]);

        for (const entry of qualifiables) {
          await Critere.findByIdAndUpdate(critereId, {
            $push: {
              second: {
                ...(entry.equipeId ? { equipeId: entry.equipeId } : {}),
                ...(entry.playerId ? { playerId: entry.playerId } : {}),
                createdAt: new Date(),
              },
            },
          });
        }
      }
    }

    // 3. Palier first (2 places)
    const alreadyFirst = (critere.first || []).filter(e => e.playerId || e.equipeId).length;
    if (alreadyFirst < 2) {
      const secondEntries = await Critere.findById(critereId).lean();
      const secondIds = (secondEntries?.second || [])
        .filter(e => e.playerId || e.equipeId)
        .map(e => (e.playerId || e.equipeId)!);
      
      if (secondIds.length > 0) {
        const qualifiables = await Enrollement.aggregate([
          { $match: { ...match, points: { $gte: firstPoints }, $or: [{ playerId: { $in: secondIds } }, { equipeId: { $in: secondIds } }] } },
          { $sort: { points: -1 } },
          { $limit: Math.min(2 - alreadyFirst, secondIds.length) },
          { $project: { _id: 1, equipeId: 1, playerId: 1, points: 1 } },
        ]);

        for (const entry of qualifiables) {
          await Critere.findByIdAndUpdate(critereId, {
            $push: {
              first: {
                ...(entry.equipeId ? { equipeId: entry.equipeId } : {}),
                ...(entry.playerId ? { playerId: entry.playerId } : {}),
                createdAt: new Date(),
              },
            },
          });
        }
      }
    }

    // Vérifier si le classement est complet (tous les paliers remplis)
    const updatedCritere = await Critere.findById(critereId).lean();
    const firstFull = (updatedCritere?.first || []).filter(e => e.playerId || e.equipeId).length >= 2;
    const isComplete = firstFull;

    if (isComplete) {
      await Critere.findByIdAndUpdate(critereId, { status: false });
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(await Critere.findById(critereId).populate('sessionId', 'designation').lean())),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── BONUS HEBDOMADAIRE ────────────────────────────────────────────

/**
 * Bonus hebdomadaire :
 * - STANDALONE : +20 parties dans le solde Player.parties
 * - ADVANCED : pour chaque enrolment actif, +30 dans maxParties de l'enrollement
 */
export async function applyWeeklyBonusAction() {
  try {
    await connectToDb();

    // STANDALONE
    const standalonePlayers = await Player.find({ type: 'STANDALONE' });
    for (const player of standalonePlayers) {
      player.parties = (player.parties || 0) + 20;
      await player.save();
    }

    // ADVANCED : ajouter +30 maxParties aux enrollements actifs
    const advancedPlayers = await Player.find({ type: 'ADVANCED' }).lean();
    for (const player of advancedPlayers) {
      await Enrollement.updateMany(
        { playerId: player._id, status: 'CONFIRMED', parcoursId: { $exists: true } },
        { $inc: { maxParties: 30 } },
      );
    }

    return {
      success: true,
      message: `Bonus appliqué : ${standalonePlayers.length} STANDALONE (+20 parties), ${advancedPlayers.length} ADVANCED (+30 maxParties/enrollement)`,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Bonus manuel : incrémente le solde de parties par palier de 3
 */
export async function applyBonusPartiesAction(playerId: string, increment: number = 3) {
  try {
    await connectToDb();

    const player = await Player.findById(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    player.parties = (player.parties || 0) + increment;
    await player.save();

    return { success: true, message: `${increment} partie(s) ajoutée(s)` };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les stats par catégorie (questions OK/NO par catégorie)
 */
export async function getCategoryStatsAction() {
  try {
    await connectToDb();

    const categories = await Categorie.find({ status: true }).lean();
    const parties = await Partie.find({ status: 'TERMINE' })
      .populate('categorieId', 'designation')
      .lean();

    const statsMap = new Map<string, { designation: string; ok: number; no: number; total: number }>();
    for (const cat of categories) {
      statsMap.set(cat._id.toString(), { designation: cat.designation, ok: 0, no: 0, total: 0 });
    }

    for (const p of parties) {
      const catId = (p.categorieId as any)?._id?.toString() || p.categorieId?.toString();
      if (catId && statsMap.has(catId)) {
        const entry = statsMap.get(catId)!;
        const bonnes = p.reponses.filter((r: any) => r.estCorrecte).length;
        entry.ok += bonnes;
        entry.no += (p.reponses.length - bonnes);
        entry.total += p.reponses.length;
      }
    }

    return {
      success: true,
      categories: Array.from(statsMap.values()).map(c => ({
        label: c.designation,
        ok: c.ok,
        no: c.no,
        total: c.total,
        percent: c.total > 0 ? Math.round((c.ok / c.total) * 100) : 0,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}