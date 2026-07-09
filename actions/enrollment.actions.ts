'use server';

import mongoose from 'mongoose';
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import EnrollementModule from "@/lib/models/Enrollement";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";
import Equipe from "@/lib/models/Equipe";
import { initiatePaymentAction, checkPaymentStatusAction, type PaymentMethod } from "@/actions/payment.actions";
import { randomUUID } from "crypto";

const { Enrollement, Session } = EnrollementModule;

// ── INFOS JOUEUR / ÉQUIPE CONNECTÉ(E) ──────────────────────────────

export interface PlayerInfo {
  _id: string;
  type: 'STANDALONE' | 'ADVANCED' | 'VIP';
  level: number;
  pseudo: string;
  telephone?: string;
  email?: string;
}

export interface EquipeInfo {
  _id: string;
  designation: string;
  chefId: string;
  telephone?: string;
  email?: string;
}

/**
 * Récupère les infos du Player connecté (pour parcours).
 * Retourne null si non connecté ou si le profil n'est pas ADVANCED/VIP.
 */
export async function getCurrentPlayerInfoAction(): Promise<{
  success: boolean;
  player?: PlayerInfo;
  error?: string;
}> {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: true };

    await connectToDb();
    const player = await Player.findOne({
      userId: new mongoose.Types.ObjectId(userSession.userId),
    })
      .populate<{ userId: { pseudo: string; telephone?: string; email?: string } }>('userId', 'pseudo telephone email')
      .lean();

    if (!player) return { success: true };
    if (player.type !== 'ADVANCED') {
      return { success: true };
    }

    const pseudo = (player.userId as any)?.pseudo || '';

    return {
      success: true,
      player: {
        _id: player._id.toString(),
        type: player.type,
        level: player.level,
        pseudo,
        telephone: (player.userId as any)?.telephone || '',
        email: (player.userId as any)?.email || '',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les infos de l'Équipe dont le joueur connecté est chef (pour compétition).
 * Retourne null si non connecté, non-VIP, ou pas chef d'équipe.
 */
export async function getCurrentEquipeInfoAction(): Promise<{
  success: boolean;
  equipe?: EquipeInfo;
  error?: string;
}> {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: true };

    await connectToDb();
    const player = await Player.findOne({
      userId: new mongoose.Types.ObjectId(userSession.userId),
    }).populate('userId', 'telephone email').lean();

    if (!player) return { success: true };
    if (player.type !== 'VIP') return { success: true };

    const equipe = await Equipe.findOne({
      chefId: player._id,
    }).lean();

    if (!equipe) return { success: true };

    return {
      success: true,
      equipe: {
        _id: equipe._id.toString(),
        designation: equipe.designation,
        chefId: equipe.chefId.toString(),
        telephone: (player.userId as any)?.telephone || '',
        email: (player.userId as any)?.email || '',
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

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
export async function getSessionsByRessourceAction(
  type: 'Parcours' | 'Competition',
  refId: string,
  activeOnly = false,
) {
  try {
    await connectToDb();
    const now = new Date();
    const sessions = await Session.find({
      ...(activeOnly ? { endDate: { $gte: now } } : {}),
      ressources: {
        $elemMatch: {
          type,
          refId: new mongoose.Types.ObjectId(refId),
        },
      },
    })
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
    if (player.type !== 'ADVANCED') {
      return { success: false, error: 'Seuls les profils ADVANCED peuvent s\'inscrire à un parcours' };
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
    const code = randomUUID();
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const enrollment = await Enrollement.create({
      playerId: new mongoose.Types.ObjectId(playerId),
      parcoursId: new mongoose.Types.ObjectId(parcoursId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      code,
      orderNumber,
      status: 'CONFIRMED',
      maxParties: 100,
      points: 0,
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
  payment: {
    phone: string;
    email?: string;
    currency: 'CDF' | 'USD';
    amount: number;
    method?: PaymentMethod;
  },
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
    const equipe = await Equipe.findOne({ chefId: player._id }).lean();
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

    if (!payment?.phone?.trim()) {
      return { success: false, error: 'Le numéro Mobile Money est requis' };
    }

    const paymentRes = await initiatePaymentAction(
      player._id.toString(),
      payment.phone.trim(),
      payment.amount,
      payment.currency,
      {
        id: competitionId,
        name: 'Enrollement compétition',
        amountCDF: 14250,
        amountUSD: 5,
        type: 'COMPETITION',
        metadata: { competitionId, sessionId, equipeId },
      },
      payment.email?.trim(),
      payment.method || "MOBILE_MONEY",
    );

    if (!paymentRes.success || !paymentRes.orderNumber) {
      return { success: false, error: paymentRes.error || 'Échec de l\'initiation du paiement' };
    }

    const code = randomUUID();
    const orderNumber = paymentRes.orderNumber;

    const enrollment = await Enrollement.create({
      equipeId: new mongoose.Types.ObjectId(equipeId),
      competitionId: new mongoose.Types.ObjectId(competitionId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
      code,
      orderNumber,
      status: 'PENDING',
      maxParties: 250,
      points: 0,
      parties: 0,
      transactions: [{
        membre: player._id,
        montant: payment.amount,
        status: 'PENDING',
        orderNumber,
        phone: payment.phone.trim(),
      }],
    });

    return {
      success: true,
      enrollment: JSON.parse(JSON.stringify(enrollment)),
      orderNumber,
      redirectUrl: paymentRes.redirectUrl,
      paymentMethod: payment.method || "MOBILE_MONEY",
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
export async function confirmCompetitionEnrollmentPaymentAction(
  enrollmentId: string,
  orderNumber: string,
  email?: string,
) {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: false, error: 'Non connecté' };

    await connectToDb();

    const enrollment = await Enrollement.findById(enrollmentId);
    if (!enrollment) return { success: false, error: 'Enrollement introuvable' };
    if (enrollment.orderNumber !== orderNumber) {
      return { success: false, error: 'Commande invalide pour cet enrollement' };
    }

    const status = await checkPaymentStatusAction(orderNumber, email, 'Enrollement compétition');
    // if (!status.success || status.status !== 'SUCCES') {
    //   return { success: false, error: status.error || 'Le paiement n\'est pas encore confirmé.' };
    // }

    enrollment.status = 'CONFIRMED';
    enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
      if (transaction.orderNumber === orderNumber) transaction.status = 'PAID';
      return transaction;
    });
    await enrollment.save();

    return {
      success: true,
      code: enrollment.code,
      enrollment: JSON.parse(JSON.stringify(enrollment)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getClassementAction(
  type?: 'Parcours' | 'Competition',
  refId?: string,
  sessionId?: string,
) {
  try {
    await connectToDb();

    if (type && refId) {
      const filter: any = { status: 'CONFIRMED' };
      if (type === 'Parcours') filter.parcoursId = new mongoose.Types.ObjectId(refId);
      if (type === 'Competition') filter.competitionId = new mongoose.Types.ObjectId(refId);
      if (sessionId) filter.sessionId = new mongoose.Types.ObjectId(sessionId);

      const enrollements = await Enrollement.find(filter)
        .populate('sessionId', 'designation startDate endDate')
        .populate({
          path: 'playerId',
          populate: { path: 'userId', select: 'pseudo telephone photo' },
        })
        .populate('equipeId', 'designation logo')
        .sort({ points: -1, updatedAt: 1 })
        .limit(20)
        .lean();

      const classement = enrollements.map((item: any) => ({
        _id: item._id.toString(),
        totalScore: item.points || 0,
        partiesJouees: item.parties || 0,
        meilleurScore: item.points || 0,
        pseudo: type === 'Competition'
          ? item.equipeId?.designation || 'Équipe'
          : item.playerId?.userId?.pseudo || 'Joueur',
        photo: type === 'Competition' ? item.equipeId?.logo : item.playerId?.userId?.photo,
        telephone: item.playerId?.userId?.telephone || '',
        type,
        level: item.playerId?.level || 0,
        code: item.code,
        session: item.sessionId,
        maxParties: item.maxParties || 0,
      }));

      return {
        success: true,
        classement: JSON.parse(JSON.stringify(classement)),
      };
    }

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
      .populate('ressources.refId')
      .sort({ startDate: -1 })
      .lean();
    return { success: true, sessions: JSON.parse(JSON.stringify(sessions)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée une session (étape 1: déclaration)
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
      ressources: [],
    });

    return { success: true, session: JSON.parse(JSON.stringify(session)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour les ressources d'une session
 */
export async function updateSessionRessourcesAction(
  sessionId: string,
  ressources: { type: 'Parcours' | 'Competition'; refId: string }[],
) {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { $set: { ressources: ressources.map(r => ({ type: r.type, refId: r.refId })) } },
      { new: true },
    ).populate('ressources.refId').lean();

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

// ── RESSOURCES LIÉES À UNE SESSION ─────────────────────────────────

/**
 * Récupère les parcours et compétitions disponibles
 */
export async function getAvailableRessourcesAction() {
  try {
    await connectToDb();
    const [parcours, competitions] = await Promise.all([
      import('@/lib/models/Competition').then(m => m.Parcours.find({ status: 'ACTIVE' }).select('_id designation slug').lean()),
      import('@/lib/models/Competition').then(m => m.Competition.find({ status: 'ACTIVE' }).select('_id designation slug amount cagnotte').lean()),
    ]);
    return {
      success: true,
      ressources: {
        parcours: JSON.parse(JSON.stringify(parcours)),
        competitions: JSON.parse(JSON.stringify(competitions)),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les enrollements pour une ressource (parcours ou compétition)
 */
export async function getEnrollementsByRessourceAction(
  type: 'Parcours' | 'Competition',
  refId: string,
  sessionId: string,
) {
  try {
    await connectToDb();

    const filter: any = { sessionId, status: 'CONFIRMED' };
    if (type === 'Parcours') {
      filter.parcoursId = refId;
    } else {
      filter.competitionId = refId;
    }

    const enrollements = await Enrollement.find(filter)
      .populate({
        path: 'playerId',
        populate: { path: 'userId', select: 'pseudo telephone photo' },
      })
      .populate({
        path: 'equipeId',
        select: 'designation',
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      enrollements: JSON.parse(JSON.stringify(enrollements)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
