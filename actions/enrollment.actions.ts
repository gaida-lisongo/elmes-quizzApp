'use server';

import mongoose from 'mongoose';
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import EnrollementModule from "@/lib/models/Enrollement";
import Partie from "@/lib/models/Partie";
import Player from "@/lib/models/Player";
import Equipe from "@/lib/models/Equipe";
import { Competition, Parcours } from "@/lib/models/Competition";
import { sendMail } from "@/lib/utils/mail";
import { initiatePaymentAction, checkPaymentStatusAction, type PaymentMethod } from "@/actions/payment.actions";
import { checkStatus } from "@/lib/utils/payment.service";
import { distributeParcoursSessionRewards } from "@/lib/utils/enrollmentRewards";
import { recomputeCompetitionScholarship } from "@/lib/utils/scholarship.service";
import { randomUUID } from "crypto";

const { Enrollement, Session } = EnrollementModule;
const PARCOURS_GRANTED_GAMES = 180;
const COMPETITION_GRANTED_GAMES = 250;

const normalizeSessionStatus = (status: string) => status.toUpperCase();

async function sendEnrollmentEmail({
  email,
  sessionName,
  resourceName,
  orderNumber,
  ressources,
  scholarshipInfo,
}: {
  email?: string;
  sessionName: string;
  resourceName: string;
  orderNumber: string;
  ressources?: string;
  scholarshipInfo?: {
    enrollmentFeeCDF: number;
    totalEnrolledTeams: number;
    currentScholarshipCDF: number;
    gamesPerTeam: number;
    unitRewardCDF: number;
    paidCurrency?: string;
  } | null;
}) {
  if (!email?.trim()) return;
  try {
    await sendMail({
      to: email,
      subject: 'ELMES-QUIZ - Confirmation d’enrollement',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Enrollement confirmé</h2>
          <p style="margin:0 0 12px;color:#334155;">Votre enrollement à la session <strong>${sessionName}</strong> est confirmé.</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Ressource :</strong> ${resourceName}</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Commande / facture :</strong> ${orderNumber}</p>
          ${scholarshipInfo ? `
            <div style="margin:16px 0;padding:14px;border:1px solid #dbe3ef;border-radius:12px;background:#fff;">
              <p style="margin:0 0 8px;color:#0f172a;font-weight:700;">Bourse d'Excellence AcadÃ©mique</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Frais d'enrÃ´lement CDF :</strong> ${scholarshipInfo.enrollmentFeeCDF.toLocaleString('fr-FR')} FC</p>
              ${scholarshipInfo.paidCurrency ? `<p style="margin:0 0 6px;color:#334155;"><strong>Devise payÃ©e :</strong> ${scholarshipInfo.paidCurrency}</p>` : ''}
              <p style="margin:0 0 6px;color:#334155;"><strong>Ã‰quipes validÃ©es :</strong> ${scholarshipInfo.totalEnrolledTeams}</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Bourse actuelle :</strong> ${scholarshipInfo.currentScholarshipCDF.toLocaleString('fr-FR')} FC</p>
              <p style="margin:0 0 6px;color:#334155;"><strong>Parties accordÃ©es Ã  l'Ã©quipe :</strong> ${scholarshipInfo.gamesPerTeam}</p>
              <p style="margin:0;color:#334155;"><strong>Valeur actuelle d'une partie gagnÃ©e :</strong> ${scholarshipInfo.unitRewardCDF.toLocaleString('fr-FR')} FC</p>
            </div>
            <p style="margin:0 0 12px;color:#334155;">La Bourse actuelle Ã©volue selon les enrÃ´lements validÃ©s et les performances.</p>
          ` : ''}
          <p style="margin:0;color:#334155;"><strong>À préparer :</strong> ${ressources?.trim() || 'Ressource à consulter dans votre espace joueur.'}</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[sendEnrollmentEmail]', error);
  }
}

async function applyEnrollmentConfirmation(enrollment: any, orderNumber: string, sendEmail = true) {
  const isCompetition = Boolean(enrollment.competitionId);
  const grantedGames = isCompetition ? COMPETITION_GRANTED_GAMES : PARCOURS_GRANTED_GAMES;

  enrollment.status = 'CONFIRMED';
  enrollment.totalGrantedGames = enrollment.totalGrantedGames || grantedGames;
  enrollment.usedGames = enrollment.usedGames || enrollment.parties || 0;
  enrollment.remainingGames = Math.max(0, (enrollment.totalGrantedGames || grantedGames) - (enrollment.usedGames || 0));
  enrollment.maxParties = enrollment.totalGrantedGames || grantedGames;
  enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
    if (!orderNumber || transaction.orderNumber === orderNumber) transaction.status = 'PAID';
    return transaction;
  });
  await enrollment.save();

  if (isCompetition && enrollment.sessionId?._id) {
    try {
      await recomputeCompetitionScholarship(enrollment.sessionId._id.toString());
    } catch (error) {
      console.error('[applyEnrollmentConfirmation] Erreur recalcul Bourse:', error);
    }
  }
  

  if (sendEmail) {
    // Récupérer les infos Bourse pour les compétitions
    let scholarshipInfo = null;
    if (isCompetition && enrollment.sessionId?._id) {
      try {
        const freshSession = await Session.findById(enrollment.sessionId._id).lean();
        if (freshSession && freshSession.scholarshipInitialAmountCDF > 0) {
          scholarshipInfo = {
            enrollmentFeeCDF: freshSession.enrollmentFeeCDF ?? 0,
            totalEnrolledTeams: freshSession.totalValidatedEnrollments ?? 0,
            currentScholarshipCDF: freshSession.scholarshipInitialAmountCDF ?? 0,
            gamesPerTeam: freshSession.gamesPerEnrollment ?? 250,
            unitRewardCDF: freshSession.unitRewardPerWonGameCDF ?? 0,
            paidCurrency: enrollment.transactions?.find((t: any) => t.orderNumber === orderNumber)?.currency,
          };
        }
      } catch (e) {
        console.error('[applyEnrollmentConfirmation] Erreur chargement Bourse:', e);
      }
    }

    await sendEnrollmentEmail({
      email: isCompetition
        ? enrollment.equipeId?.chefId?.userId?.email
        : enrollment.playerId?.userId?.email,
      sessionName: enrollment.sessionId?.designation || 'Session',
      resourceName: enrollment.competitionId?.designation || enrollment.parcoursId?.designation || 'Ressource',
      orderNumber: orderNumber || enrollment.orderNumber,
      ressources: enrollment.competitionId?.ressources || enrollment.parcoursId?.ressources,
      scholarshipInfo,
    });
  }

  // Recalculer la Bourse si c'est un enrôlement de compétition
}

async function findManageableEnrollment(enrollmentId: string) {
  if (!mongoose.Types.ObjectId.isValid(enrollmentId)) return null;
  return Enrollement.findById(enrollmentId)
    .populate('sessionId', 'designation')
    .populate('parcoursId', 'designation ressources')
    .populate('competitionId', 'designation ressources')
    .populate({ path: 'playerId', populate: { path: 'userId', select: 'email pseudo telephone' } })
    .populate({ path: 'equipeId', populate: { path: 'chefId', populate: { path: 'userId', select: 'email pseudo telephone' } } });
}

async function ensureStaffSession() {
  const session = await getSession();
  return session && ['ADMIN', 'MOD'].includes(session.role || '') ? session : null;
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

export async function enrollToParcoursAction(
  parcoursId: string,
  sessionId: string,
) {
  try {
    const userSession = await getSession();
    if (!userSession) return { success: false, error: 'Non connecté' };

    await connectToDb();

    // Résoudre le Player depuis le userId de la session
    const player = await Player.findOne({ userId: new mongoose.Types.ObjectId(userSession.userId) })
      .populate('userId', 'email')
      .lean();
    if (!player) return { success: false, error: 'Profil joueur introuvable' };
    if (player.type !== 'ADVANCED') {
      return { success: false, error: 'Seuls les profils ADVANCED peuvent s\'inscrire à un parcours' };
    }

    const playerId = player._id.toString();

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
      return { success: false, error: 'Cette session de parcours n’est pas ouverte aux enrollements' };
    }

    const parcours = await Parcours.findById(parcoursId).select('designation ressources').lean();
    if (!parcours) return { success: false, error: 'Parcours introuvable' };

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
      maxParties: PARCOURS_GRANTED_GAMES,
      totalGrantedGames: PARCOURS_GRANTED_GAMES,
      usedGames: 0,
      remainingGames: PARCOURS_GRANTED_GAMES,
      points: 0,
      parties: 0,
      transactions: [],
    });

    // TODO: brancher ici le paiement d'enrollement parcours si le produit de paiement Advanced est activé.
    await sendEnrollmentEmail({
      email: (player.userId as any)?.email,
      sessionName: (sessionDoc as any).designation,
      resourceName: (parcours as any).designation,
      orderNumber,
      ressources: (parcours as any).ressources,
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
    const player = await Player.findOne({ userId: new mongoose.Types.ObjectId(userSession.userId) })
      .populate('userId', 'email')
      .lean();
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
      return { success: false, error: 'Cette session de compétition n’est pas ouverte aux enrollements' };
    }

    const competition = await Competition.findById(competitionId).select('designation ressources amount').lean();
    if (!competition) return { success: false, error: 'Compétition introuvable' };

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

    const enrollmentAmountCDF = Number((competition as any).amount || 0);
    if (enrollmentAmountCDF <= 0) {
      return { success: false, error: 'Montant CDF de reference indisponible pour cette competition.' };
    }

    const paymentRes = await initiatePaymentAction(
      player._id.toString(),
      payment.phone.trim(),
      payment.amount,
      payment.currency,
      {
        id: competitionId,
        name: 'Enrollement compétition',
        amountCDF: enrollmentAmountCDF,
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
      maxParties: COMPETITION_GRANTED_GAMES,
      totalGrantedGames: COMPETITION_GRANTED_GAMES,
      usedGames: 0,
      remainingGames: COMPETITION_GRANTED_GAMES,
      points: 0,
      parties: 0,
      transactions: [{
        membre: player._id,
        montant: payment.amount,
        currency: payment.currency,
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

    const enrollment = await Enrollement.findById(enrollmentId)
      .populate('sessionId', 'designation')
      .populate('competitionId', 'designation ressources')
      .populate({
        path: 'equipeId',
        populate: { path: 'chefId', populate: { path: 'userId', select: 'email' } },
      });
    if (!enrollment) return { success: false, error: 'Enrollement introuvable' };
    if (enrollment.orderNumber !== orderNumber) {
      return { success: false, error: 'Commande invalide pour cet enrollement' };
    }

    const status = await checkPaymentStatusAction(orderNumber, email, 'Enrollement compétition');
    // if (!status.success || status.status !== 'SUCCES') {
    //   return { success: false, error: status.error || 'Le paiement n\'est pas encore confirmé.' };
    // }

    enrollment.status = 'CONFIRMED';
    enrollment.totalGrantedGames = enrollment.totalGrantedGames || COMPETITION_GRANTED_GAMES;
    enrollment.usedGames = enrollment.usedGames || enrollment.parties || 0;
    enrollment.remainingGames = Math.max(0, (enrollment.totalGrantedGames || COMPETITION_GRANTED_GAMES) - (enrollment.usedGames || 0));
    enrollment.maxParties = enrollment.totalGrantedGames || COMPETITION_GRANTED_GAMES;
    enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
      if (transaction.orderNumber === orderNumber) transaction.status = 'PAID';
      return transaction;
    });
    await enrollment.save();

    // Recalculer la Bourse après confirmation de paiement
    try {
      await recomputeCompetitionScholarship(enrollment.sessionId._id.toString());
    } catch (error) {
      console.error('[confirmCompetitionEnrollmentPaymentAction] Erreur recalcul Bourse:', error);
    }

    // Récupérer les infos Bourse pour le mail
    let scholarshipInfo = null;
    try {
      const freshSession = await Session.findById(enrollment.sessionId._id).lean();
      if (freshSession && freshSession.scholarshipInitialAmountCDF > 0) {
        scholarshipInfo = {
          enrollmentFeeCDF: freshSession.enrollmentFeeCDF ?? 0,
          totalEnrolledTeams: freshSession.totalValidatedEnrollments ?? 0,
          currentScholarshipCDF: freshSession.scholarshipInitialAmountCDF ?? 0,
          gamesPerTeam: freshSession.gamesPerEnrollment ?? 250,
          unitRewardCDF: freshSession.unitRewardPerWonGameCDF ?? 0,
        };
      }
    } catch (e) {
      console.error('[confirmCompetitionEnrollmentPaymentAction] Erreur chargement Bourse:', e);
    }

    await sendEnrollmentEmail({
      email: (enrollment.equipeId as any)?.chefId?.userId?.email,
      sessionName: (enrollment.sessionId as any)?.designation || 'Session',
      resourceName: (enrollment.competitionId as any)?.designation || 'Compétition',
      orderNumber,
      ressources: (enrollment.competitionId as any)?.ressources,
      scholarshipInfo,
    });

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

export async function updateSessionStatusAction(
  sessionId: string,
  nextStatus: 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'PAYMENT' | 'active' | 'inactive' | 'completed' | 'payment',
) {
  try {
    const userSession = await getSession();
    if (!userSession || !['ADMIN', 'MOD'].includes(userSession.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const normalizedStatus = normalizeSessionStatus(nextStatus);
    const session = await Session.findById(sessionId);
    if (!session) return { success: false, error: 'Session introuvable' };

    const sessionType = session.type || ((session.ressources || []).some((item: any) => item.type === 'Competition') ? 'competition' : 'parcours');
    const allowedByType: Record<string, string[]> = {
      parcours: ['ACTIVE', 'PAYMENT'],
      competition: ['ACTIVE', 'INACTIVE', 'COMPLETED'],
    };
    if (!allowedByType[sessionType]?.includes(normalizedStatus)) {
      return { success: false, error: `Statut ${normalizedStatus} invalide pour une session ${sessionType}` };
    }

    session.type = sessionType as any;
    session.status = normalizedStatus as any;
    await session.save();

    let workflowResult: any = null;
    if (session.type === 'parcours' && normalizedStatus === 'PAYMENT') {
      workflowResult = await distributeParcoursSessionRewards(sessionId);
    }
    // Dans ce code existant, COMPLETED correspond à l'ouverture effective des matchs VIP.
    // La distribution proportionnelle est tentée ici et reste idempotente si elle a déjà été faite.
    if (session.type === 'competition' && normalizedStatus === 'COMPLETED') {
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

export async function verifyEnrollmentPaymentByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };

    await connectToDb();
    const enrollment = await findManageableEnrollment(enrollmentId);
    if (!enrollment) return { success: false, error: 'Enrollement introuvable' };
    if (!enrollment.orderNumber) return { success: false, error: 'Aucune commande liée à cet enrollement.' };

    const statusCheck = await checkStatus(enrollment.orderNumber);
    if (!statusCheck.success) {
      return { success: false, error: statusCheck.error || 'Vérification FlexPay impossible.' };
    }

    if (statusCheck.status === 'SUCCES') {
      await applyEnrollmentConfirmation(enrollment, enrollment.orderNumber, true);
      return { success: true, status: statusCheck.status, message: 'Paiement confirmé et mail envoyé.' };
    }

    if (statusCheck.status === 'ECHEC') {
      enrollment.status = 'CANCELLED';
      enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
        if (transaction.orderNumber === enrollment.orderNumber) transaction.status = 'FAILED';
        return transaction;
      });
      await enrollment.save();
      return { success: true, status: statusCheck.status, message: 'Paiement échoué chez FlexPay.' };
    }

    return { success: true, status: statusCheck.status, message: 'Paiement encore en attente chez FlexPay.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Vérification impossible.' };
  }
}

export async function manuallyConfirmEnrollmentByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };

    await connectToDb();
    const enrollment = await findManageableEnrollment(enrollmentId);
    if (!enrollment) return { success: false, error: 'Enrollement introuvable' };

    await applyEnrollmentConfirmation(enrollment, enrollment.orderNumber, true);
    return { success: true, message: 'Enrollement validé manuellement et mail envoyé.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Validation impossible.' };
  }
}

export async function resendEnrollmentEmailByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };

    await connectToDb();
    const enrollment = await findManageableEnrollment(enrollmentId);
    if (!enrollment) return { success: false, error: 'Enrollement introuvable' };

    const isCompetition = Boolean(enrollment.competitionId);

    // Récupérer les infos Bourse pour le mail
    let scholarshipInfo = null;
    if (isCompetition && enrollment.sessionId?._id) {
      try {
        const freshSession = await Session.findById(enrollment.sessionId._id).lean();
        if (freshSession && freshSession.scholarshipInitialAmountCDF > 0) {
          scholarshipInfo = {
            enrollmentFeeCDF: freshSession.enrollmentFeeCDF ?? 0,
            totalEnrolledTeams: freshSession.totalValidatedEnrollments ?? 0,
            currentScholarshipCDF: freshSession.scholarshipInitialAmountCDF ?? 0,
            gamesPerTeam: freshSession.gamesPerEnrollment ?? 250,
            unitRewardCDF: freshSession.unitRewardPerWonGameCDF ?? 0,
          };
        }
      } catch (e) {
        console.error('[resendEnrollmentEmailByManagerAction] Erreur chargement Bourse:', e);
      }
    }

    await sendEnrollmentEmail({
      email: isCompetition
        ? enrollment.equipeId?.chefId?.userId?.email
        : enrollment.playerId?.userId?.email,
      sessionName: enrollment.sessionId?.designation || 'Session',
      resourceName: enrollment.competitionId?.designation || enrollment.parcoursId?.designation || 'Ressource',
      orderNumber: enrollment.orderNumber,
      ressources: enrollment.competitionId?.ressources || enrollment.parcoursId?.ressources,
      scholarshipInfo,
    });

    return { success: true, message: 'Mail envoyé.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Envoi du mail impossible.' };
  }
}

export async function deleteEnrollmentByManagerAction(enrollmentId: string) {
  try {
    const staff = await ensureStaffSession();
    if (!staff) return { success: false, error: 'Non autorisé' };

    await connectToDb();
    const deleted = await Enrollement.findByIdAndDelete(enrollmentId).lean();
    if (!deleted) return { success: false, error: 'Enrollement introuvable' };

    return { success: true, message: 'Enrollement supprimé.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Suppression impossible.' };
  }
}
