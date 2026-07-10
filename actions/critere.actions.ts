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