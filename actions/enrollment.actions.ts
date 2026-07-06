'use server';

import mongoose from 'mongoose';
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import EnrollementModule from "@/lib/models/Enrollement";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";

const { Enrollement, Session } = EnrollementModule;

// ── SESSIONS ───────────────────────────────────────────────────────

/**
 * Récupère toutes les sessions actives (non expirées)
 */
export async function getActiveSessionsAction() {
  try {
    await connectToDb();
    const now = new Date();
    const sessions = await Session.find({ endDate: { $gte: now } })
      .sort({ startDate: 1 })
      .lean();
    return {
      success: true,
      sessions: JSON.parse(JSON.stringify(sessions)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENT (PARCOURS – joueur individuel ADVANCED) ────────────

/**
 * Inscription d'un joueur ADVANCED à un parcours
 * Le joueur est résolu automatiquement depuis la session connectée.
 */
export async function enrollToParcoursAction(
  parcoursId: string,
  sessionId: string,
) {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: false, error: 'Non connecté' };

    await connectToDb();

    // Résoudre le Player depuis le userId de la session
    const player = await Player.findOne({ userId: new mongoose.Types.ObjectId(userSession.userId) }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };
    if (player.type !== 'ADVANCED' && player.type !== 'VIP') {
      return { success: false, error: 'Seuls les profils ADVANCED et VIP peuvent s\'inscrire à un parcours' };
    }

    const playerId = player._id.toString();

    // Vérifier que le joueur n'est pas déjà inscrit à ce parcours pour cette session
    const existing = await Enrollement.findOne({
      playerId: new mongoose.Types.ObjectId(playerId),
      parcoursId: new mongoose.Types.ObjectId(parcoursId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      status: { $in: ['PENDING', 'CONFIRMED'] },
    }).lean();

    if (existing) {
      return { success: false, error: 'Vous êtes déjà inscrit à ce parcours pour cette session' };
    }

    // Générer un code unique
    const code = `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const enrollment = await Enrollement.create({
      playerId: new mongoose.Types.ObjectId(playerId),
      parcoursId: new mongoose.Types.ObjectId(parcoursId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      code,
      orderNumber,
      status: 'CONFIRMED',
      parties: 0,
      transactions: [],
    });

    return {
      success: true,
      enrollment: JSON.parse(JSON.stringify(enrollment)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENT (COMPÉTITION – équipe VIP) ─────────────────────────

/**
 * Inscription d'une équipe VIP à une compétition
 * Le joueur connecté doit être le chef d'une équipe.
 */
export async function enrollToCompetitionAction(
  competitionId: string,
  sessionId: string,
) {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: false, error: 'Non connecté' };

    await connectToDb();

    // Résoudre le Player depuis la session
    const player = await Player.findOne({ userId: new mongoose.Types.ObjectId(userSession.userId) }).lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };

    // Vérifier que le joueur est VIP
    if (player.type !== 'VIP') {
      return { success: false, error: 'Seuls les profils VIP peuvent inscrire une équipe à une compétition' };
    }

    // Trouver l'équipe dont ce joueur est le chef
    const EquipeModel = mongoose.model('Equipe');
    const equipe = await EquipeModel.findOne({ chefId: player._id }).lean();
    if (!equipe) {
      return { success: false, error: 'Vous devez être chef d\'une équipe pour l\'inscrire à une compétition' };
    }

    const equipeId = equipe._id.toString();

    // Vérifier que l'équipe n'est pas déjà inscrite
    const existing = await Enrollement.findOne({
      equipeId: new mongoose.Types.ObjectId(equipeId),
      competitionId: new mongoose.Types.ObjectId(competitionId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      status: { $in: ['PENDING', 'CONFIRMED'] },
    }).lean();

    if (existing) {
      return { success: false, error: 'Votre équipe est déjà inscrite à cette compétition' };
    }

    // Générer un code unique
    const code = `ENR-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const enrollment = await Enrollement.create({
      equipeId: new mongoose.Types.ObjectId(equipeId),
      competitionId: new mongoose.Types.ObjectId(competitionId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      code,
      orderNumber,
      status: 'PENDING',
      parties: 0,
      transactions: [],
    });

    return {
      success: true,
      enrollment: JSON.parse(JSON.stringify(enrollment)),
      orderNumber,
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── CLASSEMENT ─────────────────────────────────────────────────────

/**
 * Récupère le top 5 des joueurs pour un parcours / compétition.
 * Agrège les parties (Partie) par joueur et calcule le score total.
 */
export async function getClassementAction() {
  try {
    await connectToDb();

    const topPlayers = await Partie.aggregate([
      { $match: { status: 'TERMINE' } },
      {
        $group: {
          _id: '$playerId',
          totalScore: { $sum: '$note' },
          partiesJouees: { $sum: 1 },
          meilleurScore: { $max: '$note' },
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'players',
          localField: '_id',
          foreignField: '_id',
          as: 'player',
        },
      },
      { $unwind: '$player' },
      {
        $lookup: {
          from: 'users',
          localField: 'player.userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          totalScore: 1,
          partiesJouees: 1,
          meilleurScore: 1,
          pseudo: '$user.pseudo',
          photo: '$user.photo',
          telephone: '$user.telephone',
          type: '$player.type',
          level: '$player.level',
        },
      },
    ]);

    return {
      success: true,
      classement: JSON.parse(JSON.stringify(topPlayers)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── CRUD SESSIONS ──────────────────────────────────────────────────

/**
 * Récupère toutes les sessions (admin)
 */
export async function getAllSessionsAction() {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const sessions = await Session.find()
      .sort({ startDate: -1 })
      .lean();
    return { success: true, sessions: JSON.parse(JSON.stringify(sessions)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée une session
 */
export async function createSessionAction(data: {
  designation: string;
  startDate: string;
  endDate: string;
}) {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const slug = data.designation
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();

    const session = await Session.create({
      slug,
      designation: data.designation,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    });

    return { success: true, session: JSON.parse(JSON.stringify(session)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Modifie une session
 */
export async function updateSessionAction(
  id: string,
  data: { designation?: string; startDate?: string; endDate?: string }
) {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const updateData: any = {};
    if (data.designation) updateData.designation = data.designation;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);

    const session = await Session.findByIdAndUpdate(id, { $set: updateData }, { new: true }).lean();
    if (!session) return { success: false, error: 'Session introuvable' };

    return { success: true, session: JSON.parse(JSON.stringify(session)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime une session
 */
export async function deleteSessionAction(id: string) {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    await Session.findByIdAndDelete(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}