'use server';

import mongoose from 'mongoose';
import { randomUUID } from "crypto";
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import EnrollementModule from "@/lib/models/Enrollement";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";
import Equipe from "@/lib/models/Equipe";
import { Competition, Parcours } from "@/lib/models/Competition";
import type { PaymentMethod } from "@/actions/payment.actions";
import { distributeParcoursSessionRewards } from "@/lib/utils/enrollmentRewards";
import { recomputeCompetitionScholarship } from "@/lib/utils/scholarship.service";
import { guardPermission, guardPlayer, guardStaff, hasPermission } from "@/lib/utils/guards";
import { isValidObjectId } from "@/lib/utils/security";
import { withTransaction } from "@/lib/utils/transaction";
import { getCompetitionEnrollmentPrice, getParcoursEnrollmentPrice, isCurrency, resolveCharge, type Price } from "@/lib/payments/pricing";
import { startPayment, verifyAndApplyPayment } from "@/lib/services/payment-flow.service";
import { confirmEnrollment } from "@/lib/services/enrollment.service";
import { sendEnrollmentConfirmationEmail } from "@/lib/services/enrollment-mail.service";

const { Enrollement, Session } = EnrollementModule;

const normalizeSessionStatus = (status: string) => String(status || '').toUpperCase();

async function ensureStaffSession() {
  const guard = await guardStaff();
  return guard.ok ? guard.session : null;
}

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
    const sessions = await Session.find({ endDate: { $gte: now }, status: 'ACTIVE' })
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
      ...(activeOnly ? { endDate: { $gte: now }, status: 'ACTIVE' } : {}),
      $or: [{ type: type === 'Parcours' ? 'parcours' : 'competition' }, { type: { $exists: false } }],
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

type EnrollmentResult = {
  success: boolean;
  error?: string;
  enrollment?: any;
  orderNumber?: string;
  redirectUrl?: string;
  paymentMethod?: PaymentMethod;
  amount?: number;
  currency?: 'CDF' | 'USD';
};

type EnrollmentPaymentInput = {
  phone: string;
  currency: 'CDF' | 'USD';
  method?: PaymentMethod;
  // Champs historiques ignorés : le montant vient du catalogue serveur (EX-PAY-01).
  amount?: number;
  email?: string;
};

/**
 * Enrôlement payant commun (EX-PAY-01, PAY-20) :
 * 1. l'enrôlement est créé PENDING avant le paiement (l'index unique empêche les doublons) ;
 * 2. le paiement est initié au montant serveur, avec l'identifiant de l'enrôlement ;
 * 3. l'enrôlement reçoit le numéro de commande, ou est annulé si l'initiation échoue.
 */
async function createEnrollmentAndStartPayment(params: {
  payer: any;
  productType: 'PARCOURS' | 'COMPETITION';
  productName: string;
  resourceId: string;
  price: Price;
  payment: EnrollmentPaymentInput;
  enrollmentFields: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<EnrollmentResult> {
  const { payment } = params;
  if (!isCurrency(payment?.currency)) return { success: false, error: 'Devise invalide.' };
  const method: PaymentMethod = payment?.method === 'CARD' ? 'CARD' : 'MOBILE_MONEY';
  const phone = String(payment?.phone || '').trim();
  if (!phone) return { success: false, error: 'Le numéro Mobile Money est requis' };

  const charge = resolveCharge(params.price, payment.currency);
  const placeholderOrder = `PENDING-${randomUUID()}`;

  let enrollment;
  try {
    enrollment = await Enrollement.create({
      ...params.enrollmentFields,
      code: randomUUID(),
      orderNumber: placeholderOrder,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      amountCDF: params.price.amountCDF,
      amountUSD: params.price.amountUSD,
      paidAmount: charge.amount,
      paidCurrency: charge.currency,
      paidAmountCDF: charge.amountCDF,
      fxRate: charge.fxRate,
      maxParties: 0,
      totalGrantedGames: 0,
      usedGames: 0,
      remainingGames: 0,
      points: 0,
      parties: 0,
      transactions: [],
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return { success: false, error: 'Un enrôlement est déjà en cours ou confirmé pour cette session.' };
    }
    throw error;
  }

  const paymentRes = await startPayment({
    payer: params.payer,
    productType: params.productType,
    productId: params.resourceId,
    productName: params.productName,
    amount: charge.amount,
    currency: charge.currency,
    amountCDF: charge.amountCDF,
    fxRate: charge.fxRate,
    phone,
    method,
    metadata: { ...params.metadata, enrollmentId: enrollment._id.toString() },
  });

  if (!paymentRes.success) {
    await Enrollement.updateOne(
      { _id: enrollment._id, status: 'PENDING' },
      { $set: { status: 'CANCELLED', paymentStatus: 'FAILED' } },
    );
    return { success: false, error: paymentRes.error || 'Échec de l’initiation du paiement' };
  }

  const updated = await Enrollement.findByIdAndUpdate(
    enrollment._id,
    {
      $set: { orderNumber: paymentRes.orderNumber },
      $push: {
        transactions: {
          membre: params.payer._id,
          montant: charge.amount,
          currency: charge.currency,
          status: 'PENDING',
          orderNumber: paymentRes.orderNumber,
          phone,
        },
      },
    },
    { new: true },
  ).lean();

  return {
    success: true,
    enrollment: JSON.parse(JSON.stringify(updated)),
    orderNumber: paymentRes.orderNumber,
    redirectUrl: paymentRes.redirectUrl,
    paymentMethod: method,
    amount: charge.amount,
    currency: charge.currency,
  };
}

/**
 * Un enrôlement PENDING existant : on revérifie d'abord son paiement (il peut avoir échoué
 * ou réussi entre-temps) avant de bloquer une nouvelle tentative.
 */
async function resolveExistingPendingEnrollment(filter: Record<string, unknown>) {
  const existing = await Enrollement.findOne({ ...filter, status: { $in: ['PENDING', 'CONFIRMED'] } }).lean();
  if (!existing) return null;
  if (existing.status === 'PENDING' && existing.orderNumber && !existing.orderNumber.startsWith('PENDING-')) {
    await verifyAndApplyPayment(existing.orderNumber);
    const refreshed = await Enrollement.findById(existing._id).select('status orderNumber').lean();
    if (refreshed?.status === 'CANCELLED') return null;
    if (refreshed?.status === 'PENDING') {
      return { error: `Un paiement est déjà en attente pour cet enrôlement (commande ${refreshed.orderNumber}). Validez-le sur votre téléphone, ou réessayez dans quelques minutes.` };
    }
  }
  return { error: 'already' };
}

/**
 * Inscription d'un joueur ADVANCED à un parcours.
 * Le joueur est résolu depuis la session ; le frais vient de la session (sinon 15 000 CDF).
 */
export async function enrollToParcoursAction(
  parcoursId: string,
  sessionId: string,
  payment: EnrollmentPaymentInput,
): Promise<EnrollmentResult> {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    const player = guard.player;

    if (player.type !== 'ADVANCED') {
      return { success: false, error: 'Seuls les profils ADVANCED peuvent s\'inscrire à un parcours' };
    }
    if (!isValidObjectId(parcoursId) || !isValidObjectId(sessionId)) {
      return { success: false, error: 'Paramètres invalides' };
    }

    const sessionDoc = await Session.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      $or: [{ type: 'parcours' }, { type: { $exists: false } }],
      status: 'ACTIVE',
      ressources: {
        $elemMatch: {
          type: 'Parcours',
          refId: new mongoose.Types.ObjectId(parcoursId),
        },
      },
    }).lean();
    if (!sessionDoc) {
      return { success: false, error: 'Cette session de parcours n’est pas ouverte aux enrôlements' };
    }

    const parcours = await Parcours.findById(parcoursId).select('designation ressources').lean();
    if (!parcours) return { success: false, error: 'Parcours introuvable' };

    const existing = await resolveExistingPendingEnrollment({
      playerId: player._id,
      parcoursId: new mongoose.Types.ObjectId(parcoursId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
    });
    if (existing) {
      return { success: false, error: existing.error === 'already' ? 'Vous êtes déjà inscrit à ce parcours pour cette session' : existing.error };
    }

    // PAY-05 corrigé : frais de la session s'il est configuré, sinon 15 000 CDF par défaut.
    const price = getParcoursEnrollmentPrice(sessionDoc as any);

    return await createEnrollmentAndStartPayment({
      payer: player,
      productType: 'PARCOURS',
      productName: 'Enrôlement parcours',
      resourceId: parcoursId,
      price,
      payment,
      enrollmentFields: {
        playerId: player._id,
        parcoursId: new mongoose.Types.ObjectId(parcoursId),
        sessionId: new mongoose.Types.ObjectId(sessionId),
      },
      metadata: { parcoursId, sessionId },
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── ENROLLEMENT (COMPÉTITION – équipe VIP) ─────────────────────────

/**
 * Inscription d'une équipe VIP à une compétition.
 * Le joueur connecté doit être le chef d'une équipe ; le frais vient de Competition.amount.
 */
export async function enrollToCompetitionAction(
  competitionId: string,
  sessionId: string,
  payment: EnrollmentPaymentInput,
): Promise<EnrollmentResult> {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    const player = guard.player;

    // Vérifier que le joueur est VIP
    if (player.type !== 'VIP') {
      return { success: false, error: 'Seuls les profils VIP peuvent inscrire une équipe à une compétition' };
    }
    if (!isValidObjectId(competitionId) || !isValidObjectId(sessionId)) {
      return { success: false, error: 'Paramètres invalides' };
    }

    // Trouver l'équipe dont ce joueur est le chef
    const equipe = await Equipe.findOne({ chefId: player._id }).lean();
    if (!equipe) {
      return { success: false, error: 'Vous devez être chef d\'une équipe pour l\'inscrire à une compétition' };
    }

    const sessionDoc = await Session.findOne({
      _id: new mongoose.Types.ObjectId(sessionId),
      $or: [{ type: 'competition' }, { type: { $exists: false } }],
      status: 'ACTIVE',
      ressources: {
        $elemMatch: {
          type: 'Competition',
          refId: new mongoose.Types.ObjectId(competitionId),
        },
      },
    }).lean();
    if (!sessionDoc) {
      return { success: false, error: 'Cette session de compétition n’est pas ouverte aux enrôlements' };
    }

    const competition = await Competition.findById(competitionId).select('designation ressources amount amountUSD').lean();
    if (!competition) return { success: false, error: 'Compétition introuvable' };

    const price = getCompetitionEnrollmentPrice(competition as any);
    if (!price) {
      return { success: false, error: 'Montant CDF de référence indisponible pour cette compétition.' };
    }

    const existing = await resolveExistingPendingEnrollment({
      equipeId: equipe._id,
      competitionId: new mongoose.Types.ObjectId(competitionId),
      sessionId: new mongoose.Types.ObjectId(sessionId),
    });
    if (existing) {
      return { success: false, error: existing.error === 'already' ? 'Votre équipe est déjà inscrite à cette compétition' : existing.error };
    }

    return await createEnrollmentAndStartPayment({
      payer: player,
      productType: 'COMPETITION',
      productName: 'Enrôlement compétition',
      resourceId: competitionId,
      price,
      payment,
      enrollmentFields: {
        equipeId: equipe._id,
        competitionId: new mongoose.Types.ObjectId(competitionId),
        sessionId: new mongoose.Types.ObjectId(sessionId),
      },
      metadata: { competitionId, sessionId, equipeId: equipe._id.toString() },
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Confirmation du paiement d'enrôlement d'une équipe, par son capitaine uniquement.
 * Délègue au flux unique de vérification (idempotent).
 */
export async function confirmCompetitionEnrollmentPaymentAction(
  enrollmentId: string,
  orderNumber: string,
  _email?: string,
) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };

    const enrollment = await Enrollement.findById(enrollmentId).lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };
    if (enrollment.orderNumber !== orderNumber) {
      return { success: false, error: 'Commande invalide pour cet enrôlement' };
    }

    const isCaptain = await Equipe.exists({ _id: enrollment.equipeId, chefId: guard.player._id });
    if (!isCaptain) return { success: false, error: 'Seul le capitaine de l’équipe peut confirmer ce paiement.' };

    const result = await verifyAndApplyPayment(orderNumber, { ownerPlayerId: guard.player._id.toString() });
    if (!result.success || result.status !== 'SUCCES') {
      return { success: false, error: result.error || result.message || 'Le paiement n’est pas encore confirmé.' };
    }

    const confirmed = await Enrollement.findById(enrollmentId).lean();
    return {
      success: true,
      code: confirmed?.code,
      enrollment: JSON.parse(JSON.stringify(confirmed)),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Prix officiel d'un enrôlement (affichage) : même calcul que le serveur au moment du paiement.
 */
export async function getEnrollmentPriceAction(
  type: 'Parcours' | 'Competition',
  refId: string,
  sessionId: string,
): Promise<{ success: boolean; price?: Price; error?: string }> {
  try {
    if (!isValidObjectId(refId) || !isValidObjectId(sessionId)) return { success: false, error: 'Paramètres invalides' };
    await connectToDb();
    if (type === 'Competition') {
      const competition = await Competition.findById(refId).select('amount amountUSD').lean();
      const price = competition ? getCompetitionEnrollmentPrice(competition as any) : null;
      return price ? { success: true, price } : { success: false, error: 'Montant indisponible.' };
    }
    const session = await Session.findById(sessionId).select('enrollmentFeeCDF enrollmentFeeUSD').lean();
    if (!session) return { success: false, error: 'Session introuvable' };
    return { success: true, price: getParcoursEnrollmentPrice(session as any) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ── CLASSEMENT ─────────────────────────────────────────────────────

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
          populate: { path: 'userId', select: 'pseudo photo' },
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
  type?: 'parcours' | 'competition';
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
      type: data.type || 'parcours',
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

    const current = await Session.findById(sessionId).lean();
    if (!current) return { success: false, error: 'Session introuvable' };

    const resolvedSessionType = current.type || (ressources[0]?.type === 'Competition' ? 'competition' : 'parcours');
    const expectedResourceType = resolvedSessionType === 'competition' ? 'Competition' : 'Parcours';
    if (ressources.some((item) => item.type !== expectedResourceType)) {
      return { success: false, error: `Une session ${resolvedSessionType} ne peut contenir que des ressources ${expectedResourceType}` };
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { $set: { type: resolvedSessionType, ressources: ressources.map(r => ({ type: r.type, refId: r.refId })) } },
      { new: true },
    ).populate('ressources.refId').lean();

    if (!session) return { success: false, error: 'Session introuvable' };

    return { success: true, session: JSON.parse(JSON.stringify(session)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Transitions de statut autorisées (Q-05, PAY-21) :
 * - parcours : ACTIVE → PAYMENT (clôture et paiement du top 3), sans retour ;
 * - compétition : ACTIVE → COMPLETED (« matchs ouverts ») → INACTIVE, INACTIVE → COMPLETED (reprise),
 *   ACTIVE ↔ INACTIVE tant que les matchs n'ont jamais été ouverts ; plus de retour à ACTIVE ensuite.
 */
const SESSION_TRANSITIONS: Record<string, Record<string, string[]>> = {
  parcours: {
    ACTIVE: ['PAYMENT'],
    PAYMENT: [],
  },
  competition: {
    ACTIVE: ['COMPLETED', 'INACTIVE'],
    COMPLETED: ['INACTIVE'],
    INACTIVE: ['COMPLETED', 'ACTIVE'],
  },
};

export async function updateSessionStatusAction(
  sessionId: string,
  nextStatus: 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'PAYMENT' | 'active' | 'inactive' | 'completed' | 'payment',
) {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(sessionId)) return { success: false, error: 'Session introuvable' };
    await connectToDb();

    const normalizedStatus = normalizeSessionStatus(nextStatus);
    const session = await Session.findById(sessionId);
    if (!session) return { success: false, error: 'Session introuvable' };

    const sessionType = session.type || ((session.ressources || []).some((item: any) => item.type === 'Competition') ? 'competition' : 'parcours');
    const currentStatus = normalizeSessionStatus(session.status || 'ACTIVE');
    if (currentStatus === normalizedStatus) {
      return { success: false, error: `La session est déjà au statut ${normalizedStatus}.` };
    }

    const allowed = SESSION_TRANSITIONS[sessionType]?.[currentStatus] || [];
    if (!allowed.includes(normalizedStatus)) {
      return { success: false, error: `Transition ${currentStatus} → ${normalizedStatus} interdite pour une session ${sessionType}.` };
    }
    if (sessionType === 'competition' && normalizedStatus === 'ACTIVE' && session.matchesOpenedAt) {
      return { success: false, error: 'Les matchs ont déjà été ouverts : la session ne peut plus revenir aux inscriptions.' };
    }
    if (sessionType === 'competition' && normalizedStatus === 'COMPLETED' && currentStatus === 'INACTIVE'
      && session.matchesOpenedAt && (session.scholarshipRemainingAmountCDF ?? 0) <= 0) {
      return { success: false, error: 'La Bourse est épuisée : les matchs ne peuvent pas être rouverts.' };
    }
    // La clôture d'un parcours déclenche le paiement du top 3 : permission FINANCE pour un MOD (Q-08).
    if (normalizedStatus === 'PAYMENT' && !(await hasPermission(guard.session, 'FINANCE'))) {
      return { success: false, error: 'Permission FINANCE requise pour clôturer et payer une session.' };
    }

    // Transition atomique depuis le statut lu (deux gestionnaires ne déclenchent pas deux fois le workflow).
    const transitioned = await Session.updateOne(
      { _id: session._id, status: session.status },
      {
        $set: {
          type: sessionType,
          status: normalizedStatus,
          ...(normalizedStatus === 'COMPLETED' && !session.matchesOpenedAt ? { matchesOpenedAt: new Date() } : {}),
        },
      },
    );
    if (!transitioned.modifiedCount) {
      return { success: false, error: 'Le statut de la session vient de changer. Rechargez la page.' };
    }

    let workflowResult: any = null;
    if (sessionType === 'parcours' && normalizedStatus === 'PAYMENT') {
      workflowResult = await distributeParcoursSessionRewards(sessionId);
    }
    // COMPLETED correspond à l'ouverture effective des matchs VIP : la Bourse est (re)calculée.
    if (sessionType === 'competition' && normalizedStatus === 'COMPLETED') {
      workflowResult = await recomputeCompetitionScholarship(sessionId);
    }

    const updated = await Session.findById(sessionId).populate('ressources.refId').lean();
    return { success: true, session: JSON.parse(JSON.stringify(updated)), workflowResult };
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
    // Renvoie téléphones et e-mails des inscrits : réservé au staff (EX-SEC-04).
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };
    if (!mongoose.Types.ObjectId.isValid(String(refId)) || !mongoose.Types.ObjectId.isValid(String(sessionId))) {
      return { success: false, error: 'Paramètres invalides' };
    }

    await connectToDb();

    const filter: any = { sessionId };
    if (type === 'Parcours') {
      filter.parcoursId = refId;
    } else {
      filter.competitionId = refId;
    }

    const enrollements = await Enrollement.find(filter)
      .populate({
        path: 'playerId',
        populate: { path: 'userId', select: 'pseudo telephone email photo' },
      })
      .populate({
        path: 'equipeId',
        select: 'designation chefId',
        populate: { path: 'chefId', populate: { path: 'userId', select: 'pseudo telephone email' } },
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

const hasConsumedGames = (enrollment: any) =>
  Boolean(enrollment.gamesGranted || enrollment.gamesGrantedAt)
  || Number(enrollment.usedGames || 0) > 0
  || Number(enrollment.parties || 0) > 0;

/**
 * Vérification du paiement d'un enrôlement par un gestionnaire : même flux unique et idempotent
 * que le callback et le bouton du joueur (EX-PAY-02).
 */
export async function verifyEnrollmentPaymentByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };

    await connectToDb();
    const enrollment = await Enrollement.findById(enrollmentId).select('orderNumber').lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };
    if (!enrollment.orderNumber || enrollment.orderNumber.startsWith('PENDING-')) {
      return { success: false, error: 'Aucune commande liée à cet enrôlement.' };
    }

    const result = await verifyAndApplyPayment(enrollment.orderNumber);
    if (!result.success) return { success: false, error: result.error || 'Vérification impossible.' };

    const messages: Record<string, string> = {
      SUCCES: 'Paiement confirmé.',
      ECHEC: 'Paiement échoué chez le fournisseur : enrôlement annulé.',
      EN_ATTENTE: 'Paiement encore en attente chez le fournisseur.',
      A_VERIFIER: 'Montant payé différent du montant attendu : vérification manuelle requise.',
    };
    return { success: true, status: result.status, message: messages[result.status || ''] || result.message };
  } catch (error: any) {
    return { success: false, error: error.message || 'Vérification impossible.' };
  }
}

/**
 * Validation manuelle sans paiement vérifié : ADMIN, ou MOD avec la permission FINANCE (Q-08),
 * car elle accorde des parties et alimente la Bourse.
 */
export async function manuallyConfirmEnrollmentByManagerAction(enrollmentId: string) {
  try {
    const guard = await guardPermission('FINANCE');
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };

    await connectToDb();
    const enrollment = await Enrollement.findById(enrollmentId).select('orderNumber').lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };

    const result = await withTransaction((dbSession) =>
      confirmEnrollment(enrollmentId, { orderNumber: enrollment.orderNumber }, dbSession),
    );
    if (result.confirmed) await sendEnrollmentConfirmationEmail(enrollmentId, enrollment.orderNumber);
    return {
      success: true,
      message: result.confirmed ? 'Enrôlement validé manuellement et mail envoyé.' : 'Enrôlement déjà confirmé.',
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Validation impossible.' };
  }
}

export async function updateEnrollmentStatusByManagerAction(
  enrollmentId: string,
  nextStatus: 'PENDING' | 'CONFIRMED' | 'CANCELLED',
) {
  try {
    if (nextStatus === 'CONFIRMED') {
      return manuallyConfirmEnrollmentByManagerAction(enrollmentId);
    }

    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };
    if (nextStatus !== 'PENDING' && nextStatus !== 'CANCELLED') return { success: false, error: 'Statut invalide.' };

    await connectToDb();
    const enrollment = await Enrollement.findById(enrollmentId).lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };

    if (hasConsumedGames(enrollment) || enrollment.status === 'CONFIRMED') {
      return {
        success: false,
        error: 'Statut non modifiable : l’enrôlement est confirmé ou des parties ont déjà été accordées.',
      };
    }

    const transactionStatus = nextStatus === 'CANCELLED' ? 'FAILED' : 'PENDING';
    await Enrollement.updateOne(
      { _id: enrollmentId, status: { $ne: 'CONFIRMED' }, gamesGranted: { $ne: true } },
      {
        $set: {
          status: nextStatus,
          paymentStatus: nextStatus === 'CANCELLED' ? 'FAILED' : 'PENDING',
          'transactions.$[].status': transactionStatus,
        },
      },
    );

    return { success: true, message: "Statut de l'enrôlement mis à jour." };
  } catch (error: any) {
    return { success: false, error: error.message || 'Changement de statut impossible.' };
  }
}

export async function resendEnrollmentEmailByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };

    await connectToDb();
    const enrollment = await Enrollement.findById(enrollmentId).select('orderNumber status').lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };
    if (enrollment.status !== 'CONFIRMED') return { success: false, error: 'Seul un enrôlement confirmé peut recevoir la confirmation.' };

    await sendEnrollmentConfirmationEmail(enrollmentId, enrollment.orderNumber);
    return { success: true, message: 'Mail envoyé.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Envoi du mail impossible.' };
  }
}

export async function deleteEnrollmentByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };
    if (!isValidObjectId(enrollmentId)) return { success: false, error: 'Enrôlement introuvable' };

    await connectToDb();
    const enrollment = await Enrollement.findById(enrollmentId).lean();
    if (!enrollment) return { success: false, error: 'Enrôlement introuvable' };

    if (hasConsumedGames(enrollment) || enrollment.status === 'CONFIRMED') {
      return {
        success: false,
        error: 'Suppression impossible : l’enrôlement est confirmé ou des parties ont déjà été accordées.',
      };
    }

    await Enrollement.deleteOne({ _id: enrollment._id, status: { $ne: 'CONFIRMED' }, gamesGranted: { $ne: true } });

    return { success: true, message: 'Enrôlement supprimé.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Suppression impossible.' };
  }
}
