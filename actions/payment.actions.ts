'use server';

import mongoose from "mongoose";
import connectToDb from "@/lib/utils/db";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import Agent from "@/lib/models/Agent";
import { initiatePayout, checkStatus } from "@/lib/utils/payment.service";
import { getSession } from "@/lib/utils/auth";
import type { PipelineStage } from "mongoose";
import { guardAdmin, guardPermission, guardPlayer, guardSession, guardStaff } from "@/lib/utils/guards";
import { escapeRegex, isValidObjectId } from "@/lib/utils/security";
import { consumeRateLimit, getClientIp } from "@/lib/utils/rateLimit";
import { tx, withTransaction } from "@/lib/utils/transaction";
import { getTrainingPass, isCurrency, resolveCharge } from "@/lib/payments/pricing";
import { generatePaymentReference, startPayment, verifyAndApplyPayment, type VerifyResult } from "@/lib/services/payment-flow.service";

type ActionResult = { success: boolean; status?: string; message?: string; error?: string };

export type PaymentMethod = "MOBILE_MONEY" | "CARD";

// ── CONSTANTES ─────────────────────────────────────────────────────

const PACK_NAMES: Record<number, string> = {
  1: "ELEMBO",
  2: "MOTUYA",
  3: "ELONGA",
};

const PASS_BY_LEVEL: Record<number, string> = { 1: "elembo", 2: "motuya", 3: "elonga" };

// Retraits (Q-03) : minimum 1 000 CDF, sans frais au lancement.
const RETRAIT_MINIMUM_CDF = 1000;
// TODO(Q-03): plafond journalier à fixer par le propriétaire (RETRAIT_PLAFOND_JOURNALIER_CDF). Sans valeur : pas de plafond.
const RETRAIT_PLAFOND_JOURNALIER_CDF = Number(process.env.RETRAIT_PLAFOND_JOURNALIER_CDF) > 0
  ? Number(process.env.RETRAIT_PLAFOND_JOURNALIER_CDF)
  : null;

const isPaymentMethod = (value: unknown): value is PaymentMethod => value === "MOBILE_MONEY" || value === "CARD";
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\s/g, "").trim();
const isValidPhone = (value: string) => /^\+?\d{9,15}$/.test(value);

// ═══════════════════════════════════════════════════════════════════
//  PAYMENT DRAWER (produit : TRAINING_PASS)
// ═══════════════════════════════════════════════════════════════════

/**
 * Recherche de joueurs (autocomplete) : session exigée, recherche échappée,
 * aucune donnée personnelle renvoyée (pas de téléphone ni d'e-mail) (EX-SEC-04).
 */
export async function searchUsers(query: string) {
  try {
    const guard = await guardSession();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    const search = String(query ?? "").trim().slice(0, 50);
    if (search.length < 2) {
      return { success: true, users: [] };
    }

    const users = await User.find({ pseudo: new RegExp(escapeRegex(search), "i"), role: "PLAYER" })
      .limit(10)
      .select("pseudo photo")
      .lean();

    const players = await Player.find({ userId: { $in: users.map((u) => u._id) } }).select("userId type").lean();
    const playerByUser = new Map(players.map((p) => [p.userId.toString(), p]));

    return {
      success: true,
      users: users
        .filter((u) => playerByUser.has(u._id.toString()))
        .map((u) => {
          const player = playerByUser.get(u._id.toString())!;
          return {
            _id: u._id.toString(),
            pseudo: u.pseudo,
            photo: u.photo,
            playerId: player._id.toString(),
            playerType: player.type || null,
          };
        }),
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

/**
 * Recherche d'un joueur par téléphone ou e-mail : réservé au staff.
 */
export async function findPlayerByContact(phone: string, email?: string) {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    const query: Record<string, string> = {};
    if (typeof phone === "string" && phone.trim()) query.telephone = phone.trim();
    if (typeof email === "string" && email.trim()) query.email = email.trim();
    if (Object.keys(query).length === 0) return { success: false, error: 'Téléphone ou e-mail requis.' };

    const user = await User.findOne(query).lean();
    if (!user) {
      return { success: false, error: 'Aucun compte trouvé avec ces coordonnées.' };
    }

    const player = await Player.findOne({ userId: user._id }).lean();
    if (!player) {
      return { success: false, error: 'Profil joueur introuvable.' };
    }

    return {
      success: true,
      player: {
        playerId: player._id.toString(),
        pseudo: user.pseudo,
        telephone: user.telephone,
        email: user.email,
        solde: user.solde,
        parties: player.parties,
        level: player.level,
        type: player.type,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

/**
 * Achat d'un Pass d'entraînement (EX-PAY-01, EX-SEC-03).
 * Le payeur est le joueur de la session ; le montant vient du catalogue serveur.
 * Achat pour un tiers (Q-07) : `beneficiaryUserId` doit désigner un joueur existant.
 */
export async function initiatePaymentAction(input: {
  productId: string;
  currency: 'CDF' | 'USD';
  phone: string;
  method?: PaymentMethod;
  beneficiaryUserId?: string;
}) {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };

    const ip = await getClientIp();
    const rate = await consumeRateLimit(`payin:${guard.session.userId}:${ip}`, 10, 10 * 60 * 1000);
    if (!rate.allowed) return { success: false, error: 'Trop de tentatives de paiement. Réessayez dans quelques minutes.' };

    const pass = getTrainingPass(input?.productId);
    if (!pass) return { success: false, error: 'Produit inconnu.' };
    if (!isCurrency(input?.currency)) return { success: false, error: 'Devise invalide.' };
    const method: PaymentMethod = isPaymentMethod(input?.method) ? input.method : "MOBILE_MONEY";

    let beneficiaryPlayerId: mongoose.Types.ObjectId | undefined;
    if (input?.beneficiaryUserId) {
      if (!isValidObjectId(input.beneficiaryUserId)) return { success: false, error: 'Bénéficiaire invalide.' };
      const beneficiary = await Player.findOne({ userId: input.beneficiaryUserId }).select('_id').lean();
      if (!beneficiary) return { success: false, error: 'Le bénéficiaire doit être un joueur existant.' };
      if (beneficiary._id.toString() !== guard.player._id.toString()) {
        beneficiaryPlayerId = beneficiary._id as mongoose.Types.ObjectId;
      }
    }

    const charge = resolveCharge(pass, input.currency);
    const result = await startPayment({
      payer: guard.player,
      productType: 'TRAINING_PASS',
      productId: pass.id,
      productName: pass.name,
      amount: charge.amount,
      currency: charge.currency,
      amountCDF: charge.amountCDF,
      fxRate: charge.fxRate,
      targetLevel: pass.targetLevel,
      phone: input.phone,
      method,
      beneficiaryPlayerId,
    });

    if (!result.success) return result;

    return {
      success: true,
      orderNumber: result.orderNumber,
      redirectUrl: result.redirectUrl,
      paymentMethod: method,
      amount: charge.amount,
      currency: charge.currency,
      message: method === "CARD"
        ? 'Paiement carte initié. Redirection vers FlexPay.'
        : 'Paiement initié. En attente de confirmation.',
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

/**
 * Vérification d'un paiement depuis la page de retour ou le lien reçu par e-mail.
 * Appelée en POST (bouton) ; le résultat ne dépend que de l'état en base et du fournisseur.
 */
export async function verifyPaymentByOrderNumberAction(orderNumber: string): Promise<VerifyResult> {
  try {
    const ip = await getClientIp();
    const rate = await consumeRateLimit(`verify:${ip}`, 30, 10 * 60 * 1000);
    if (!rate.allowed) return { success: false, error: 'Trop de vérifications. Réessayez dans quelques minutes.' };
    return await verifyAndApplyPayment(String(orderNumber || ''));
  } catch (error: any) {
    console.error("[verifyPaymentByOrderNumberAction]", error?.message);
    return { success: false, error: "Erreur de vérification." };
  }
}

/**
 * Bouton « vérifier » du joueur, sur l'un de ses propres paiements.
 */
export async function verifyMyPaymentAction(orderNumber: string): Promise<VerifyResult> {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };
    return await verifyAndApplyPayment(String(orderNumber || ''), { ownerPlayerId: guard.player._id.toString() });
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de vérification." };
  }
}

export async function verifyMyRechargeAction(rechargeIndex: number): Promise<VerifyResult> {
  try {
    const guard = await guardPlayer();
    if (!guard.ok) return { success: false, error: guard.error };

    const recharge = guard.player.recharges?.[Number(rechargeIndex)];
    if (!recharge) return { success: false, error: "Recharge introuvable." };

    return await verifyAndApplyPayment(recharge.providerTxId || recharge.reference || "", {
      ownerPlayerId: guard.player._id.toString(),
    });
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de vérification." };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RECHARGE JOUEUR (par niveau de pack, compatibilité)
// ═══════════════════════════════════════════════════════════════════

/**
 * Initie l'achat du pack correspondant à un niveau cible (1 ELEMBO, 2 MOTUYA, 3 ELONGA)
 * pour le joueur connecté. Le montant vient du catalogue serveur.
 */
export async function rechargePlayerAction(
  phone: string,
  targetLevel: number,
  currency: 'CDF' | 'USD' = 'CDF',
  paymentMethod: PaymentMethod = "MOBILE_MONEY",
) {
  const productId = PASS_BY_LEVEL[Number(targetLevel)];
  if (!productId) return { success: false, error: "Le niveau cible doit être 1, 2 ou 3." };
  return initiatePaymentAction({ productId, currency, phone, method: paymentMethod });
}

/**
 * Retourne la liste des recharges du joueur connecté avec les infos utilisateur.
 */
export async function getMyRechargesAction() {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Non connecté." };
    }

    await connectToDb();

    const user = await User.findById(session.userId);
    if (!user) {
      return { success: false, error: "Utilisateur introuvable." };
    }

    const player = await Player.findOne({ userId: session.userId });
    if (!player) {
      return { success: false, error: "Profil joueur introuvable." };
    }

    return {
      success: true,
      data: {
        playerId: player._id.toString(),
        userId: user._id.toString(),
        telephone: user.telephone,
        pseudo: user.pseudo,
        solde: user.solde,
        parties: player.parties,
        level: player.level,
        recharges: player.recharges.map((r, index) => ({
          index,
          amount: r.amount,
          amountCDF: r.amountCDF ?? r.amount,
          providerTxId: r.providerTxId,
          status: r.status,
          targetLevel: r.targetLevel,
          currency: r.currency,
          productType: r.productType,
          createdAt: r.createdAt,
        })),
      },
    };
  } catch (error: any) {
    console.error("[getMyRechargesAction]", error?.message);
    return {
      success: false,
      error: error.message || "Erreur lors de la récupération.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RETRAIT AGENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Paiement Mobile Money vers un agent : ADMIN uniquement, vers le téléphone du compte de l'agent.
 * TODO(PAY-24): aucun solde de commission agent n'existe ; flux à définir avant tout usage.
 */
export async function payoutAgentAction(
  agentId: string,
  _phone: string,
  amount: number,
) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    const numericAmount = Number(amount);
    if (!isValidObjectId(agentId) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return {
        success: false,
        error: "Tous les champs sont obligatoires : agent et montant.",
      };
    }

    await connectToDb();

    // 1. Vérifier que l'agent existe
    const agent = await Agent.findById(agentId).populate<{ userId: { telephone: string } }>('userId', 'telephone');
    if (!agent || !agent.userId?.telephone) {
      return { success: false, error: "Agent introuvable." };
    }

    // 2. Générer une référence unique
    const reference = generatePaymentReference('AGENT');

    // 3. Initier le paiement via FlexPay, uniquement vers le numéro du compte de l'agent
    const payout = await initiatePayout({
      phone: agent.userId.telephone,
      amount: numericAmount,
      reference,
    });

    if (!payout.success || !payout.orderNumber) {
      return {
        success: false,
        error: payout.error || "Échec de l'initiation du paiement.",
        providerMessage: payout.message,
      };
    }

    // 4. Enregistrer le sous-document de retrait dans Agent
    await Agent.updateOne(
      { _id: agent._id },
      { $push: { retraits: { amount: numericAmount, providerTxId: payout.orderNumber, status: "EN_ATTENTE", createdAt: new Date() } } },
    );

    return {
      success: true,
      orderNumber: payout.orderNumber,
      message: "Paiement initié. En attente de confirmation.",
    };
  } catch (error: any) {
    console.error("[payoutAgentAction]", error?.message);
    return {
      success: false,
      error: error.message || "Erreur serveur lors du retrait.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RETRAIT JOUEUR (avec réservation du solde, EX-PAY-04)
// ═══════════════════════════════════════════════════════════════════

/**
 * Demande de retrait : minimum et plafond (Q-03), puis réservation atomique du montant
 * (soldeBloque) à condition que le solde disponible (solde - soldeBloque) suffise.
 * Le téléphone saisi est enregistré comme bénéficiaire (PAY-26).
 */
export async function requestRetraitAction(phone: string, amount: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    const numericAmount = Math.floor(Number(amount));
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: "Téléphone et montant requis." };
    }
    if (!isValidPhone(cleanPhone)) return { success: false, error: "Numéro Mobile Money invalide." };

    await connectToDb();

    if (session.role !== 'PLAYER') {
      // TODO(PAY-24): flux de retrait des agents à définir (aucun solde de commission ni validation).
      return { success: false, error: "Les retraits des agents ne sont pas encore disponibles." };
    }

    if (numericAmount < RETRAIT_MINIMUM_CDF) {
      return { success: false, error: `Le montant minimum d'un retrait est de ${RETRAIT_MINIMUM_CDF.toLocaleString("fr-FR")} FC.` };
    }

    const player = await Player.findOne({ userId: session.userId }).select('_id retraits').lean();
    if (!player) return { success: false, error: "Profil joueur introuvable." };

    if (RETRAIT_PLAFOND_JOURNALIER_CDF) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const usedToday = (player.retraits || [])
        .filter((r: any) => r.status !== 'ECHEC' && new Date(r.createdAt) >= since)
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
      if (usedToday + numericAmount > RETRAIT_PLAFOND_JOURNALIER_CDF) {
        return { success: false, error: `Plafond de retrait sur 24 heures atteint (${RETRAIT_PLAFOND_JOURNALIER_CDF.toLocaleString("fr-FR")} FC).` };
      }
    }

    const reference = generatePaymentReference('RETRAIT');

    const reserved = await withTransaction(async (dbSession) => {
      const user = await User.findOneAndUpdate(
        {
          _id: session.userId,
          $expr: { $gte: [{ $subtract: ['$solde', { $ifNull: ['$soldeBloque', 0] }] }, numericAmount] },
        },
        { $inc: { soldeBloque: numericAmount } },
        { new: true, ...tx(dbSession) },
      );
      if (!user) return false;

      await Player.updateOne(
        { _id: player._id },
        {
          $push: {
            retraits: {
              amount: numericAmount,
              providerTxId: reference,
              reference,
              status: "EN_ATTENTE",
              method: "MOBILE_MONEY",
              currency: "CDF",
              phone: cleanPhone,
              createdAt: new Date(),
            },
          },
        },
        tx(dbSession),
      );
      return true;
    });

    if (!reserved) return { success: false, error: "Solde disponible insuffisant." };

    return { success: true, orderNumber: reference, message: "Demande de retrait enregistrée. Le montant est réservé jusqu'à la validation par un gestionnaire." };
  } catch (error: any) {
    console.error("[requestRetraitAction]", error?.message);
    return { success: false, error: error.message || "Erreur serveur." };
  }
}

/**
 * Statut d'un retrait du joueur connecté (lecture seule : la validation relève du gestionnaire).
 */
export async function checkRetraitStatusAction(retraitIndex: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();

    let retraitDoc: { amount: number; status: string } | null = null;

    if (session.role === 'PLAYER') {
      const player = await Player.findOne({ userId: session.userId }).select('retraits').lean();
      if (!player) return { success: false, error: "Joueur introuvable." };
      retraitDoc = (player.retraits || [])[Number(retraitIndex)] || null;
    } else {
      const agent = await Agent.findOne({ userId: session.userId }).select('retraits').lean();
      if (!agent) return { success: false, error: "Agent introuvable." };
      retraitDoc = (agent.retraits || [])[Number(retraitIndex)] || null;
    }
    if (!retraitDoc) return { success: false, error: "Retrait introuvable." };

    return {
      success: true,
      status: retraitDoc.status,
      message: retraitDoc.status === "SUCCES"
        ? `Retrait confirmé ! ${(retraitDoc.amount || 0).toLocaleString("fr-FR")} FC versés.`
        : retraitDoc.status === "ECHEC"
          ? "Le retrait a échoué : le montant a été restitué sur votre solde."
          : retraitDoc.status === "EN_COURS"
            ? "Retrait en cours de versement."
            : "En attente de validation.",
    };
  } catch (error: any) {
    console.error("[checkRetraitStatusAction]", error?.message);
    return { success: false, error: error.message || "Erreur." };
  }
}

/**
 * Récupère les infos + historique des retraits (Player ou Agent).
 */
export async function getMyRetraitsAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();
    const user = await User.findById(session.userId);
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    let retraits: any[] = [];

    if (session.role === 'PLAYER') {
      const player = await Player.findOne({ userId: session.userId });
      if (player) {
        retraits = (player.retraits || []).map((r, i) => ({ index: i, amount: r.amount, providerTxId: r.providerTxId, reference: r.reference, status: r.status, method: r.method, currency: r.currency, phone: r.phone, message: r.message, processedAt: r.processedAt, createdAt: r.createdAt }));
      }
    } else {
      const agent = await Agent.findOne({ userId: session.userId });
      if (agent) {
        retraits = (agent.retraits || []).map((r, i) => ({ index: i, amount: r.amount, providerTxId: r.providerTxId, status: r.status, createdAt: r.createdAt }));
      }
    }

    const soldeBloque = user.soldeBloque || 0;
    return {
      success: true,
      data: {
        solde: user.solde,
        soldeBloque,
        soldeDisponible: (user.solde || 0) - soldeBloque,
        retraitMinimum: RETRAIT_MINIMUM_CDF,
        pseudo: user.pseudo,
        telephone: user.telephone,
        role: user.role,
        retraits,
      },
    };
  } catch (error: any) {
    console.error("[getMyRetraitsAction]", error?.message);
    return { success: false, error: error.message || "Erreur." };
  }
}

export async function getWalletSummaryAction() {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();
    const user = await User.findById(session.userId).lean();
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    const player = await Player.findOne({ userId: session.userId }).lean();
    const recentRecharges = (player?.recharges || []).slice(-5).reverse().map((r: any, index: number) => ({
      index,
      type: "recharge",
      amount: r.amount,
      currency: r.currency || "CDF",
      status: r.status,
      providerTxId: r.providerTxId,
      createdAt: r.createdAt,
    }));
    const recentWithdrawals = (player?.retraits || []).slice(-5).reverse().map((r: any, index: number) => ({
      index,
      type: "withdrawal",
      amount: r.amount,
      currency: r.currency || "CDF",
      status: r.status,
      providerTxId: r.providerTxId,
      createdAt: r.createdAt,
    }));

    return {
      success: true,
      data: {
        availableBalance: (user.solde || 0) - (user.soldeBloque || 0),
        pendingBalance: user.soldeBloque || 0,
        recentTransactions: [...recentRecharges, ...recentWithdrawals]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur solde." };
  }
}

export async function getPendingWithdrawalsAdminAction() {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();
    const players = await Player.find({ "retraits.status": { $in: ["EN_ATTENTE", "EN_COURS"] } })
      .populate("userId", "pseudo telephone solde soldeBloque role")
      .lean();

    const withdrawals = players.flatMap((player: any) =>
      (player.retraits || [])
        .map((retrait: any, index: number) => ({ retrait, index }))
        .filter(({ retrait }: any) => ["EN_ATTENTE", "EN_COURS"].includes(retrait.status))
        .map(({ retrait, index }: any) => ({
          playerId: player._id.toString(),
          retraitIndex: index,
          pseudo: player.userId?.pseudo || "Joueur",
          telephone: retrait.phone || player.userId?.telephone || "",
          solde: player.userId?.solde || 0,
          soldeBloque: player.userId?.soldeBloque || 0,
          amount: retrait.amount,
          providerTxId: retrait.providerTxId,
          reference: retrait.reference,
          status: retrait.status,
          method: retrait.method || "MOBILE_MONEY",
          currency: retrait.currency || "CDF",
          message: retrait.message,
          createdAt: retrait.createdAt,
        })),
    );

    return { success: true, data: withdrawals };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur retraits admin." };
  }
}

/** Retrait versé : débit définitif du solde et libération de la réservation, dans la même opération. */
async function settleWithdrawalSuccess(userId: string, playerId: string, retraitId: string, amount: number, message: string) {
  await withTransaction(async (dbSession) => {
    const res = await Player.updateOne(
      { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: "EN_COURS" } } },
      { $set: { "retraits.$.status": "SUCCES", "retraits.$.message": message, "retraits.$.processedAt": new Date(), "retraits.$.validatedAt": new Date() } },
      tx(dbSession),
    );
    if (!res.modifiedCount) return;
    const debited = await User.updateOne(
      { _id: userId, solde: { $gte: amount }, soldeBloque: { $gte: amount } },
      { $inc: { solde: -amount, soldeBloque: -amount } },
      tx(dbSession),
    );
    if (!debited.modifiedCount) {
      // Un solde négatif doit être impossible : on annule plutôt que de le masquer.
      throw new Error("Incohérence de solde : débit impossible. Vérification manuelle requise.");
    }
  });
}

/** Retrait refusé : la réservation est libérée, le joueur récupère son argent. */
async function releaseWithdrawal(userId: string, playerId: string, retraitId: string, amount: number, message: string) {
  await withTransaction(async (dbSession) => {
    const res = await Player.updateOne(
      { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: { $in: ["EN_ATTENTE", "EN_COURS"] } } } },
      { $set: { "retraits.$.status": "ECHEC", "retraits.$.message": message, "retraits.$.processedAt": new Date() } },
      tx(dbSession),
    );
    if (!res.modifiedCount) return;
    await User.updateOne({ _id: userId, soldeBloque: { $gte: amount } }, { $inc: { soldeBloque: -amount } }, tx(dbSession));
  });
}

/**
 * Validation d'un retrait (EX-PAY-04, Q-08) : ADMIN, ou MOD avec la permission FINANCE.
 * - EN_ATTENTE → EN_COURS de façon atomique, puis payout ;
 * - payout confirmé → débit définitif ; échec → réservation libérée ;
 * - payout incertain (erreur réseau, délai) → reste EN_COURS : pas de remboursement, réconciliation.
 * Rappeler l'action sur un retrait EN_COURS ne fait que revérifier le statut du fournisseur.
 */
export async function validateWithdrawalAdminAction(playerId: string, retraitIndex: number): Promise<ActionResult> {
  try {
    const guard = await guardPermission("FINANCE");
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(playerId)) return { success: false, error: "Joueur introuvable." };

    await connectToDb();
    const player = await Player.findById(playerId).select("userId retraits").lean();
    if (!player) return { success: false, error: "Joueur introuvable." };

    const retrait: any = player.retraits?.[Number(retraitIndex)];
    if (!retrait?._id) return { success: false, error: "Retrait introuvable." };
    const retraitId = retrait._id.toString();
    const userId = player.userId.toString();
    const amount = Number(retrait.amount);

    // Déjà en cours : on ne relance pas de payout, on revérifie seulement le fournisseur.
    if (retrait.status === "EN_COURS") {
      const hasProviderTx = retrait.providerTxId && retrait.providerTxId !== retrait.reference;
      if (!hasProviderTx) {
        // TODO(lot 4): réconciliation des payouts incertains (aucune commande fournisseur connue).
        return { success: false, status: "EN_COURS", error: "Versement incertain : à réconcilier avec le fournisseur avant toute nouvelle action." };
      }
      return await applyPayoutStatus(userId, playerId, retraitId, amount, retrait.providerTxId);
    }

    if (retrait.status !== "EN_ATTENTE") {
      return { success: false, error: "Ce retrait a déjà été traité." };
    }

    const user = await User.findById(userId).select("telephone").lean();
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    // Passage atomique EN_ATTENTE → EN_COURS : un double clic ou deux gestionnaires ne déclenchent qu'un payout.
    const claimed = await Player.updateOne(
      { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: "EN_ATTENTE" } } },
      { $set: { "retraits.$.status": "EN_COURS", "retraits.$.validatedBy": guard.session.userId } },
    );
    if (!claimed.modifiedCount) return { success: false, error: "Ce retrait a déjà été traité." };

    const reference = retrait.reference || retrait.providerTxId;
    const payout = await initiatePayout({
      phone: retrait.phone || user.telephone,
      amount,
      reference,
      currency: retrait.currency || "CDF",
    });

    if (!payout.success || !payout.orderNumber) {
      const providerAnswered = Boolean(payout.raw);
      if (providerAnswered && String(payout.raw?.status) === "0XX6") {
        // Fonds marchand insuffisants : le retrait repasse en attente (montant toujours réservé).
        await Player.updateOne(
          { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: "EN_COURS" } } },
          { $set: { "retraits.$.status": "EN_ATTENTE", "retraits.$.message": payout.error || "Veuillez patienter." } },
        );
        return { success: false, status: "EN_ATTENTE", error: payout.error || "Veuillez patienter le temps que nous disposions des fonds." };
      }
      if (providerAnswered) {
        await releaseWithdrawal(userId, playerId, retraitId, amount, payout.error || "Refusé par le fournisseur.");
        return { success: false, status: "ECHEC", error: payout.error || "Le fournisseur a refusé le retrait. Le montant a été restitué." };
      }
      // Aucune réponse exploitable (réseau, délai) : paiement incertain, pas de remboursement.
      await Player.updateOne(
        { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: "EN_COURS" } } },
        { $set: { "retraits.$.message": payout.error || "Réponse du fournisseur incertaine." } },
      );
      return { success: false, status: "EN_COURS", error: "Réponse du fournisseur incertaine : le retrait reste en cours et doit être réconcilié." };
    }

    await Player.updateOne(
      { _id: playerId, retraits: { $elemMatch: { _id: retraitId, status: "EN_COURS" } } },
      { $set: { "retraits.$.providerTxId": payout.orderNumber } },
    );

    return await applyPayoutStatus(userId, playerId, retraitId, amount, payout.orderNumber);
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur validation retrait." };
  }
}

async function applyPayoutStatus(userId: string, playerId: string, retraitId: string, amount: number, providerTxId: string): Promise<ActionResult> {
  const statusCheck = await checkStatus(providerTxId);
  if (!statusCheck.success || statusCheck.status === "EN_ATTENTE" || !statusCheck.status) {
    return { success: true, status: "EN_COURS", message: "Versement initié. Statut du fournisseur encore en attente : revérifiez plus tard." };
  }
  if (statusCheck.status === "ECHEC") {
    await releaseWithdrawal(userId, playerId, retraitId, amount, statusCheck.message || "Retrait échoué chez le fournisseur.");
    return { success: false, status: "ECHEC", error: "Le fournisseur a refusé le retrait. Le montant a été restitué au joueur." };
  }
  await settleWithdrawalSuccess(userId, playerId, retraitId, amount, statusCheck.message || "Retrait validé.");
  return { success: true, status: "SUCCES", message: "Retrait versé et solde débité." };
}

// ═══════════════════════════════════════════════════════════════════
//  VENTES / SUPERVISION ADMIN
// ═══════════════════════════════════════════════════════════════════

export interface VentesRechargeItem {
  playerId: string;
  playerPseudo: string;
  playerPhone: string;
  rechargeIndex: number;
  amount: number;
  currency: "CDF" | "USD";
  amountCDF: number;
  providerTxId: string;
  status: "EN_ATTENTE" | "SUCCES" | "ECHEC" | "A_VERIFIER";
  targetLevel: number;
  createdAt: Date;
}

export interface VentesMetrics {
  total: number;
  enAttente: number;
  succes: number;
  echec: number;
  montantTotal: number; // Équivalent CDF
}

export interface VentesRechargesData {
  recharges: VentesRechargeItem[];
  metrics: VentesMetrics;
  targetLevel: number;
  packName: string;
}

/**
 * Récupère toutes les recharges d'un niveau cible donné (staff).
 */
export async function getVentesRechargesAction(
  targetLevel: number,
): Promise<{ success: boolean; data?: VentesRechargesData; error?: string }> {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    if (![1, 2, 3].includes(targetLevel)) {
      return { success: false, error: "Niveau cible invalide (1, 2 ou 3)." };
    }

    await connectToDb();

    const pipeline: PipelineStage[] = [
      {
        $unwind: {
          path: "$recharges",
          preserveNullAndEmptyArrays: false,
          includeArrayIndex: "rechargeIndex",
        },
      },
      { $match: { "recharges.targetLevel": targetLevel } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          playerId: { $toString: "$_id" },
          playerPseudo: { $ifNull: ["$user.pseudo", "Inconnu"] },
          playerPhone: { $ifNull: ["$user.telephone", "N/A"] },
          rechargeIndex: 1,
          amount: "$recharges.amount",
          currency: { $ifNull: ["$recharges.currency", "CDF"] },
          amountCDF: { $ifNull: ["$recharges.amountCDF", "$recharges.amount"] },
          providerTxId: "$recharges.providerTxId",
          status: "$recharges.status",
          targetLevel: "$recharges.targetLevel",
          createdAt: "$recharges.createdAt",
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const results = await Player.aggregate(pipeline);

    const metrics: VentesMetrics = {
      total: results.length,
      enAttente: results.filter((r) => r.status === "EN_ATTENTE").length,
      succes: results.filter((r) => r.status === "SUCCES").length,
      echec: results.filter((r) => r.status === "ECHEC").length,
      montantTotal: results.reduce((sum, r) => sum + (r.amountCDF || 0), 0),
    };

    return {
      success: true,
      data: {
        recharges: results as VentesRechargeItem[],
        metrics,
        targetLevel,
        packName: PACK_NAMES[targetLevel] || `Niveau ${targetLevel}`,
      },
    };
  } catch (error: any) {
    console.error("[getVentesRechargesAction]", error?.message);
    return { success: false, error: error.message || "Erreur serveur." };
  }
}

/**
 * Annule une recharge non appliquée (ADMIN) : annulation logique, la trace est conservée.
 */
export async function deleteRechargeAction(
  playerId: string,
  rechargeIndex: number,
) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };
    if (!isValidObjectId(playerId)) return { success: false, error: "Joueur introuvable." };

    await connectToDb();

    const player = await Player.findById(playerId).select("recharges").lean();
    if (!player) return { success: false, error: "Joueur introuvable." };

    const recharge: any = player.recharges?.[Number(rechargeIndex)];
    if (!recharge?._id) return { success: false, error: "Index de recharge invalide." };
    if (recharge.status === "SUCCES" || recharge.appliedAt) {
      return { success: false, error: "Une recharge validée ne peut pas être annulée." };
    }

    await Player.updateOne(
      { _id: playerId, recharges: { $elemMatch: { _id: recharge._id, status: { $ne: "SUCCES" }, appliedAt: { $exists: false } } } },
      { $set: { "recharges.$.status": "ECHEC", "recharges.$.failureReason": "Annulée par un administrateur." } },
    );

    return { success: true, message: "Recharge annulée." };
  } catch (error: any) {
    console.error("[deleteRechargeAction]", error?.message);
    return { success: false, error: error.message || "Erreur lors de l'annulation." };
  }
}
