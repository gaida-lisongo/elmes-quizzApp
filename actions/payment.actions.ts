'use server';

import connectToDb from "@/lib/utils/db";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import Agent from "@/lib/models/Agent";
import { initiateCollection, initiatePayout, checkStatus } from "@/lib/utils/payment.service";
import { getSession } from "@/lib/utils/auth";
import type { PipelineStage } from "mongoose";
import type { IRetrait } from "@/lib/models/Player";

export type ProductPayload = {
  id: string;
  name: string;
  amountCDF: number;
  amountUSD?: number;
  type: 'TRAINING_PASS' | 'COMPETITION' | 'EQUIPE';
  metadata?: Record<string, any>;
};

// ── CONSTANTES ─────────────────────────────────────────────────────

const USD_TO_CDF_RATE = 2200;

const converUSDToCDF = (amountUSD: number) => {
  if (!amountUSD || amountUSD <= 0) return 0;
  switch (amountUSD) {
    case 1: return 3000;
    case 2: return 5000;
    case 4: return 10000;
    default: return 0;
  }
};

const PACK_NAMES: Record<number, string> = {
  1: "ELEMBO",
  2: "MOTUYA",
  3: "ELONGA",
};

// ═══════════════════════════════════════════════════════════════════
//  PAYMENT DRAWER (produits : TRAINING_PASS, COMPETITION, EQUIPE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Étape 1 — Trouver le joueur par téléphone ou email
 */
export async function findPlayerByContact(phone: string, email?: string) {
  try {
    await connectToDb();

    const query: any = {};
    if (phone) query.telephone = phone;
    if (email) query.email = email;

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
 * Étape 3 — Initier le paiement et enregistrer la recharge
 */
export async function initiatePaymentAction(
  playerId: string,
  phone: string,
  amount: number,
  currency: 'CDF' | 'USD',
  product: ProductPayload,
) {
  try {
    await connectToDb();

    const player = await Player.findById(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    const reference = `PAY-${product.type}-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const collection = await initiateCollection({
      phone,
      amount,
      reference,
      currency,
    });

    if (!collection.success || !collection.orderNumber) {
      return {
        success: false,
        error: collection.error || 'Échec de l\'initiation du paiement.',
        providerMessage: collection.message,
      };
    }

    const orderNumber = collection.orderNumber;

    // Enregistrer la recharge dans Player
    player.recharges.push({
      amount,
      providerTxId: orderNumber,
      status: 'EN_ATTENTE',
      targetLevel: product.type === 'TRAINING_PASS' ? 1 : 0,
      currency,
      createdAt: new Date(),
    });

    await player.save();

    return { success: true, orderNumber, message: 'Paiement initié. En attente de confirmation.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

/**
 * Vérifier le statut d'une transaction
 */
export async function checkPaymentStatusAction(orderNumber: string) {
  try {
    const statusCheck = await checkStatus(orderNumber);
    if (!statusCheck.success) {
      return { success: false, error: statusCheck.error || 'Impossible de vérifier le statut.' };
    }
    return {
      success: true,
      status: statusCheck.status,
      message:
        statusCheck.status === 'SUCCES'
          ? 'Paiement confirmé !'
          : statusCheck.status === 'ECHEC'
            ? 'Le paiement a échoué.'
            : 'En attente de confirmation.',
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de vérification.' };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RECHARGE JOUEUR (passer à un niveau supérieur)
// ═══════════════════════════════════════════════════════════════════

/**
 * Initie une collecte Mobile Money pour un joueur et enregistre la recharge
 * dans son document Player avec le statut EN_ATTENTE.
 */
export async function rechargePlayerAction(
  playerId: string,
  phone: string,
  targetLevel: number,
  amount: number,
  currency: 'CDF' | 'USD' = 'CDF',
) {
  try {
    if (!playerId || !phone || !amount || !targetLevel) {
      return {
        success: false,
        error: "Tous les champs sont obligatoires : joueur, téléphone, montant et niveau.",
      };
    }

    if (![1, 2, 3].includes(targetLevel)) {
      return {
        success: false,
        error: "Le niveau cible doit être 1, 2 ou 3.",
      };
    }

    await connectToDb();

    // 1. Vérifier que le joueur existe
    const player = await Player.findById(playerId);
    if (!player) {
      return { success: false, error: "Joueur introuvable." };
    }

    // 2. Montant stocké en CDF dans la DB
    const amountCDF = currency === 'USD' ? converUSDToCDF(amount) : amount;
    const amountProvider = amount;
    const providerCurrency = currency;

    // 3. Générer une référence unique locale
    const reference = `REQ-REC-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 4. Initier la collecte via FlexPay (dans la devise d'origine)
    const collection = await initiateCollection({
      phone,
      amount: amountProvider,
      reference,
      currency: providerCurrency,
    });

    console.log("Recharge Response :", collection);

    if (!collection.success || !collection.orderNumber) {
      return {
        success: false,
        error: collection.error || "Échec de l'initiation de la collecte.",
        providerMessage: collection.message,
      };
    }

    const orderNumber = collection.orderNumber;

    // 5. Enregistrer le sous-document de recharge dans Player (toujours en CDF)
    player.recharges.push({
      amount: amountCDF,
      providerTxId: orderNumber,
      status: "EN_ATTENTE",
      targetLevel,
      currency,
      createdAt: new Date(),
    });

    await player.save();

    return {
      success: true,
      orderNumber,
      amountCDF,
      currency,
      message: "Collecte initiée. En attente de confirmation.",
    };
  } catch (error: any) {
    console.error("[rechargePlayerAction]", error);
    return {
      success: false,
      error: error.message || "Erreur serveur lors de la recharge.",
    };
  }
}

/**
 * Vérifie le statut d'une recharge auprès du microservice.
 * Si le statut est SUCCES, crédite les parties du joueur.
 */
export async function checkRechargeStatusAction(
  playerId: string,
  rechargeIndex: number,
  parties: number = 0
) {
  try {
    await connectToDb();

    const player = await Player.findById(playerId);
    if (!player) {
      return { success: false, error: "Joueur introuvable." };
    }

    const recharge = player.recharges[rechargeIndex];
    if (!recharge) {
      return { success: false, error: "Recharge introuvable." };
    }

    if (recharge.status !== "EN_ATTENTE") {
      return {
        success: true,
        status: recharge.status,
        message: "Cette recharge a déjà été traitée.",
      };
    }

    // Appeler le microservice
    const statusCheck = await checkStatus(recharge.providerTxId);
    console.log("[Checking Recharge]", statusCheck);
    if (!statusCheck.success) {
      return {
        success: false,
        error: statusCheck.error || "Impossible de vérifier le statut.",
      };
    }

    const newStatus = statusCheck.status || "ECHEC";

    // Mettre à jour le statut local dans le sous-document
    player.recharges[rechargeIndex].status = newStatus;

    // Si la collecte est confirmée → créditer les parties du joueur
    if (newStatus === "SUCCES") {
      player.parties += parties;

      // Bonus parrainage : +3 parties pour le parrain si referedBy est défini
      if (player.referedBy) {
        const parrain = await Player.findById(player.referedBy);
        if (parrain) {
          parrain.parties += parties / 5; // 20% de bonus pour le parrain
          await parrain.save();
        }
      }
    }

    await player.save();

    return {
      success: true,
      status: newStatus,
      message:
        newStatus === "SUCCES"
          ? `Paiement confirmé ! ${recharge.amount} FC crédités sur votre solde.`
          : newStatus === "ECHEC"
            ? "Le paiement a échoué."
            : "Toujours en attente.",
    };
  } catch (error: any) {
    console.error("[checkRechargeStatusAction]", error);
    return {
      success: false,
      error: error.message || "Erreur lors de la vérification.",
    };
  }
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
          providerTxId: r.providerTxId,
          status: r.status,
          targetLevel: r.targetLevel,
          currency: r.currency,
          createdAt: r.createdAt,
        })),
      },
    };
  } catch (error: any) {
    console.error("[getMyRechargesAction]", error);
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
 * Initie un paiement Mobile Money vers un agent et enregistre le retrait
 * dans son document Agent avec le statut EN_ATTENTE.
 */
export async function payoutAgentAction(
  agentId: string,
  phone: string,
  amount: number,
) {
  try {
    if (!agentId || !phone || !amount) {
      return {
        success: false,
        error: "Tous les champs sont obligatoires : agent, téléphone et montant.",
      };
    }

    await connectToDb();

    // 1. Vérifier que l'agent existe
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: "Agent introuvable." };
    }

    // 2. Générer une référence unique locale
    const reference = `REQ-OUT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // 3. Initier le paiement via FlexPay
    const payout = await initiatePayout({
      phone,
      amount,
      reference,
    });

    if (!payout.success || !payout.orderNumber) {
      return {
        success: false,
        error: payout.error || "Échec de l'initiation du paiement.",
        providerMessage: payout.message,
      };
    }

    const orderNumber = payout.orderNumber;

    // 4. Enregistrer le sous-document de retrait dans Agent
    agent.retraits.push({
      amount,
      providerTxId: orderNumber,
      status: "EN_ATTENTE",
      createdAt: new Date(),
    });

    await agent.save();

    return {
      success: true,
      orderNumber,
      message: "Paiement initié. En attente de confirmation.",
    };
  } catch (error: any) {
    console.error("[payoutAgentAction]", error);
    return {
      success: false,
      error: error.message || "Erreur serveur lors du retrait.",
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  RETRAIT PARTAGÉ (Player / Agent)
// ═══════════════════════════════════════════════════════════════════

/**
 * Initie un retrait Mobile Money.
 * - Joueur : déduit son solde User après confirmation
 * - Agent  : enregistre dans Agent.retraits[] (commission)
 */
export async function requestRetraitAction(phone: string, amount: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    if (!phone || !amount || amount <= 0) {
      return { success: false, error: "Téléphone et montant requis." };
    }

    await connectToDb();
    const user = await User.findById(session.userId);
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    // Vérifier le solde
    if (user.solde < amount) {
      return { success: false, error: "Solde insuffisant." };
    }

    const reference = `WTH-${user.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const payout = await initiatePayout({ phone, amount, reference });
    if (!payout.success || !payout.orderNumber) {
      return { success: false, error: payout.error || "Échec de l'initiation du retrait." };
    }

    // Enregistrer selon le rôle
    if (user.role === 'PLAYER') {
      const player = await Player.findOne({ userId: session.userId });
      if (!player) return { success: false, error: "Profil joueur introuvable." };
      player.retraits.push({
        amount,
        providerTxId: payout.orderNumber,
        status: "EN_ATTENTE",
        createdAt: new Date(),
      });
      await player.save();
    } else {
      const agent = await Agent.findOne({ userId: session.userId });
      if (!agent) return { success: false, error: "Profil agent introuvable." };
      agent.retraits.push({
        amount,
        providerTxId: payout.orderNumber,
        status: "EN_ATTENTE",
        createdAt: new Date(),
      });
      await agent.save();
    }

    return { success: true, orderNumber: payout.orderNumber, message: "Retrait initié. En attente de confirmation." };
  } catch (error: any) {
    console.error("[requestRetraitAction]", error);
    return { success: false, error: error.message || "Erreur serveur." };
  }
}

/**
 * Vérifie le statut d'un retrait.
 * Si SUCCES → réduit le solde User.
 */
export async function checkRetraitStatusAction(retraitIndex: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();

    let retraitDoc: { amount: number; providerTxId: string; status: string; createdAt: Date } | null = null;

    if (session.role === 'PLAYER') {
      const player = await Player.findOne({ userId: session.userId });
      if (!player) return { success: false, error: "Joueur introuvable." };
      const retraits = player.retraits || [];
      const r = retraits[retraitIndex];
      if (!r) return { success: false, error: "Retrait introuvable." };
      if (r.status !== "EN_ATTENTE") return { success: true, status: r.status, message: "Déjà traité." };

      const statusCheck = await checkStatus(r.providerTxId);
      if (!statusCheck.success) return { success: false, error: statusCheck.error || "Impossible de vérifier." };

      const newStatus = statusCheck.status || "ECHEC";
      player.retraits[retraitIndex].status = newStatus;

      if (newStatus === "SUCCES") {
        const user = await User.findById(session.userId);
        if (user) { user.solde = Math.max(0, user.solde - r.amount); await user.save(); }
      }
      await player.save();
      retraitDoc = player.retraits[retraitIndex];
    } else {
      const agent = await Agent.findOne({ userId: session.userId });
      if (!agent) return { success: false, error: "Agent introuvable." };
      const retraits = agent.retraits || [];
      const r = retraits[retraitIndex];
      if (!r) return { success: false, error: "Retrait introuvable." };
      if (r.status !== "EN_ATTENTE") return { success: true, status: r.status, message: "Déjà traité." };

      const statusCheck = await checkStatus(r.providerTxId as string);
      if (!statusCheck.success) return { success: false, error: statusCheck.error || "Impossible de vérifier." };

      const newStatus = statusCheck.status || "ECHEC";
      agent.retraits[retraitIndex].status = newStatus;

      if (newStatus === "SUCCES") {
        const user = await User.findById(session.userId);
        if (user) { user.solde = Math.max(0, user.solde - r.amount); await user.save(); }
      }
      await agent.save();
      retraitDoc = agent.retraits[retraitIndex] as IRetrait;
    }

    return {
      success: true,
      status: retraitDoc?.status,
      message: retraitDoc?.status === "SUCCES"
        ? `Retrait confirmé ! ${(retraitDoc?.amount || 0).toLocaleString("fr-FR")} FC déduits.`
        : retraitDoc?.status === "ECHEC" ? "Le retrait a échoué." : "En attente.",
    };
  } catch (error: any) {
    console.error("[checkRetraitStatusAction]", error);
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
        retraits = (player.retraits || []).map((r, i) => ({ index: i, amount: r.amount, providerTxId: r.providerTxId, status: r.status, createdAt: r.createdAt }));
      }
    } else {
      const agent = await Agent.findOne({ userId: session.userId });
      if (agent) {
        retraits = (agent.retraits || []).map((r, i) => ({ index: i, amount: r.amount, providerTxId: r.providerTxId, status: r.status, createdAt: r.createdAt }));
      }
    }

    return { success: true, data: { solde: user.solde, pseudo: user.pseudo, telephone: user.telephone, role: user.role, retraits } };
  } catch (error: any) {
    console.error("[getMyRetraitsAction]", error);
    return { success: false, error: error.message || "Erreur." };
  }
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
  providerTxId: string;
  status: "EN_ATTENTE" | "SUCCES" | "ECHEC";
  targetLevel: number;
  createdAt: Date;
}

export interface VentesMetrics {
  total: number;
  enAttente: number;
  succes: number;
  echec: number;
  montantTotal: number;
}

export interface VentesRechargesData {
  recharges: VentesRechargeItem[];
  metrics: VentesMetrics;
  targetLevel: number;
  packName: string;
}

/**
 * Récupère toutes les recharges d'un niveau cible donné (usage admin).
 * Utilise une agrégation MongoDB optimisée pour extraire les recharges
 * du tableau imbriqué `Player.recharges` filtré par `targetLevel`.
 */
export async function getVentesRechargesAction(
  targetLevel: number,
): Promise<{ success: boolean; data?: VentesRechargesData; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    if (![1, 2, 3].includes(targetLevel)) {
      return { success: false, error: "Niveau cible invalide (1, 2 ou 3)." };
    }

    await connectToDb();

    // Agrégation : unwind recharges, filtrer par targetLevel, lookup User pour pseudo/phone
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
          providerTxId: "$recharges.providerTxId",
          status: "$recharges.status",
          targetLevel: "$recharges.targetLevel",
          createdAt: "$recharges.createdAt",
        },
      },
      { $sort: { createdAt: -1 } },
    ];

    const results = await Player.aggregate(pipeline);

    // Calculer les métriques
    const metrics: VentesMetrics = {
      total: results.length,
      enAttente: results.filter((r) => r.status === "EN_ATTENTE").length,
      succes: results.filter((r) => r.status === "SUCCES").length,
      echec: results.filter((r) => r.status === "ECHEC").length,
      montantTotal: results.reduce((sum, r) => sum + (r.amount || 0), 0),
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
    console.error("[getVentesRechargesAction]", error);
    return { success: false, error: error.message || "Erreur serveur." };
  }
}

/**
 * Supprime une recharge d'un joueur (admin uniquement).
 */
export async function deleteRechargeAction(
  playerId: string,
  rechargeIndex: number,
) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();

    const player = await Player.findById(playerId);
    if (!player) return { success: false, error: "Joueur introuvable." };

    if (rechargeIndex < 0 || rechargeIndex >= player.recharges.length) {
      return { success: false, error: "Index de recharge invalide." };
    }

    // Supprimer l'élément du tableau
    player.recharges.splice(rechargeIndex, 1);
    await player.save();

    return { success: true, message: "Recharge supprimée avec succès." };
  } catch (error: any) {
    console.error("[deleteRechargeAction]", error);
    return { success: false, error: error.message || "Erreur lors de la suppression." };
  }
}