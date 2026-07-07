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
      .populate('ressourceId', 'designation slug')
      .sort({ createdAt: -1 })
      .lean();

    return { success: true, criteres: JSON.parse(JSON.stringify(criterres)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCritereAction(data: {
  ressource: 'Parcours' | 'Competition';
  ressourceId: string;
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

    const critere = await Critere.create({
      ressource: data.ressource,
      ressourceId: new mongoose.Types.ObjectId(data.ressourceId),
      designation: data.designation,
      slug,
      description: data.description,
      first: [{ points: data.firstPoints, recompense: data.firstRecompense }],
      second: [{ points: data.secondPoints, recompense: data.secondRecompense }],
      third: [{ points: data.thirdPoints, recompense: data.thirdRecompense }],
      status: true,
    });

    return { success: true, critere: JSON.parse(JSON.stringify(critere)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCritereAction(
  id: string,
  data: { status?: boolean; first?: any[]; second?: any[]; third?: any[]; points?: number; designation?: string; description?: string },
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
    if (data.first) update.first = data.first;
    if (data.second) update.second = data.second;
    if (data.third) update.third = data.third;

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
 * - third : 6 premières entités (équipe/joueur) à atteindre le palier → qualifiées
 * - second : parmi les 6 qualifiées, les 4 premières à atteindre le 2e palier
 * - first : parmi les 4, les 2 premières à atteindre le 1er palier
 */
export async function checkCriteresClassementAction(critereId: string) {
  try {
    await connectToDb();

    const critere = await Critere.findById(critereId).lean();
    if (!critere) return { success: false, error: 'Critère introuvable' };
    if (!critere.status) return { success: false, error: 'Critère inactif' };

    const thirdPoints = critere.third[0]?.points || 0;
    const secondPoints = critere.second[0]?.points || 0;
    const firstPoints = critere.first[0]?.points || 0;
    const isEquipe = critere.ressource === 'Competition';

    // Récupérer les enrollements pour cette ressource
    const matchField = isEquipe ? 'equipeId' : 'playerId';
    const idField = isEquipe ? 'equipeId' : 'playerId';

    // 1. Palier third (6 places) — déjà qualifiés
    const alreadyThird = (critere.third || []).filter(e => e.playerId || e.equipeId).length;

    if (alreadyThird < 6) {
      const qualifiables = await Enrollement.aggregate([
        { $match: { [idField]: { $exists: true, $ne: null }, status: 'CONFIRMED', points: { $gte: thirdPoints } } },
        { $group: { _id: `$${idField}`, totalPoints: { $sum: '$points' }, count: { $sum: 1 } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 6 - alreadyThird },
      ]);

      for (const entry of qualifiables) {
        const update: any = { $push: { third: { points: entry.totalPoints, recompense: critere.third[0]?.recompense || '', createdAt: new Date() } } };
        if (isEquipe) update['$set'] = { 'third.$[].equipeId': entry._id };
        else update['$set'] = { 'third.$[].playerId': entry._id };
        await Critere.findByIdAndUpdate(critereId, {
          $push: {
            third: {
              points: entry.totalPoints,
              recompense: critere.third[0]?.recompense || '',
              ...(isEquipe ? { equipeId: entry._id } : { playerId: entry._id }),
              createdAt: new Date(),
            },
          },
        });
      }
    }

    // 2. Palier second (4 places) — parmi les qualifiés third
    const alreadySecond = (critere.second || []).filter(e => e.playerId || e.equipeId).length;
    const thirdIds = (critere.third || [])
      .filter(e => e.playerId || e.equipeId)
      .map(e => (e.playerId || e.equipeId)?.toString());

    if (alreadySecond < 4 && thirdIds.length > 0) {
      const matchIds = thirdIds.map(id => new mongoose.Types.ObjectId(id));
      const qualifiables = await Enrollement.aggregate([
        { $match: { [idField]: { $in: matchIds }, status: 'CONFIRMED', points: { $gte: secondPoints } } },
        { $group: { _id: `$${idField}`, totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 4 - alreadySecond },
      ]);

      for (const entry of qualifiables) {
        await Critere.findByIdAndUpdate(critereId, {
          $push: {
            second: {
              points: entry.totalPoints,
              recompense: critere.second[0]?.recompense || '',
              ...(isEquipe ? { equipeId: entry._id } : { playerId: entry._id }),
              createdAt: new Date(),
            },
          },
        });
      }
    }

    // 3. Palier first (2 places) — parmi les qualifiés second
    const alreadyFirst = (critere.first || []).filter(e => e.playerId || e.equipeId).length;
    const secondIds = (critere.second || [])
      .filter(e => e.playerId || e.equipeId)
      .map(e => (e.playerId || e.equipeId)?.toString());

    if (alreadyFirst < 2 && secondIds.length > 0) {
      const matchIds = secondIds.map(id => new mongoose.Types.ObjectId(id));
      const qualifiables = await Enrollement.aggregate([
        { $match: { [idField]: { $in: matchIds }, status: 'CONFIRMED', points: { $gte: firstPoints } } },
        { $group: { _id: `$${idField}`, totalPoints: { $sum: '$points' } } },
        { $sort: { totalPoints: -1 } },
        { $limit: 2 - alreadyFirst },
      ]);

      for (const entry of qualifiables) {
        await Critere.findByIdAndUpdate(critereId, {
          $push: {
            first: {
              points: entry.totalPoints,
              recompense: critere.first[0]?.recompense || '',
              ...(isEquipe ? { equipeId: entry._id } : { playerId: entry._id }),
              createdAt: new Date(),
            },
          },
        });
      }
    }

    // Vérifier si le classement est complet (tous les paliers remplis)
    const updatedCritere = await Critere.findById(critereId).lean();
    const firstFull = (updatedCritere?.first || []).filter(e => e.playerId || e.equipeId).length >= 2;
    const isComplete = firstFull;

    if (isComplete) {
      await Critere.findByIdAndUpdate(critereId, { status: false });
      // Marquer la ressource comme INACTIVE
      const ressourceModel = critere.ressource === 'Competition' ? Competition : Parcours;
      await ressourceModel.findByIdAndUpdate(critere.ressourceId, { status: 'INACTIVE' });
    }

    return {
      success: true,
      data: JSON.parse(JSON.stringify(await Critere.findById(critereId).populate('ressourceId', 'designation').lean())),
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

    return { success: true, message: `${increment} partie(s) ajoutée(s) à ${player.pseudo || 'joueur'}` };
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