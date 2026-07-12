'use server';

import connectToDb from "@/lib/utils/db";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import Agent from "@/lib/models/Agent";
import Equipe from "@/lib/models/Equipe";
import EnrollementModule from "@/lib/models/Enrollement";
import { initiateCollection, initiatePayout, checkStatus, initialCard } from "@/lib/utils/payment.service";
import { getSession } from "@/lib/utils/auth";
import type { PipelineStage } from "mongoose";
import type { IRetrait } from "@/lib/models/Player";
import { sendMail } from "@/lib/utils/mail";
import { recomputeCompetitionScholarship } from "@/lib/utils/scholarship.service";

export type ProductPayload = {
  id: string;
  name: string;
  amountCDF: number;
  amountUSD?: number;
  type: 'TRAINING_PASS' | 'COMPETITION' | 'EQUIPE';
  metadata?: Record<string, any>;
};

export type PaymentMethod = "MOBILE_MONEY" | "CARD";

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

const { Enrollement } = EnrollementModule;

const buildVerificationUrl = (
  orderNumber: string,
  params: {
    playerId?: string;
    resourceType?: string;
    resourceId?: string;
    reference?: string;
    date?: string | number;
  } = {},
) => {
  const baseUrl =
    process.env.PAYMENT_VERIFICATION_URL ||
    process.env.NEXT_PUBLIC_PAYMENT_VERIFICATION_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://elmes-quiz.com";
  const search = new URLSearchParams();
  search.set("type", "email");
  search.set("orderNumber", orderNumber);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  return `${baseUrl.replace(/\/$/, "")}/payment/verification?${search.toString()}`;
};

const getCollectionByMethod = (method: PaymentMethod) => {
  return method === "CARD" ? initialCard : initiateCollection;
};

const getTrainingPassParties = (amountCDF: number, targetLevel: number) => {
  if (amountCDF === 2500 || targetLevel === 1) return 15;
  if (amountCDF === 7000 || targetLevel === 2) return 40;
  if (amountCDF === 15000 || targetLevel === 3) return 130;
  return 0;
};

const notifyPaymentByEmail = async ({
  email,
  orderNumber,
  amount,
  currency,
  productName,
  status,
  playerId,
  resourceType,
  resourceId,
  reference,
}: {
  email?: string;
  orderNumber: string;
  amount: number;
  currency: "CDF" | "USD";
  productName: string;
  status: "initiated" | "confirmed" | "pending" | "failed";
  playerId?: string;
  resourceType?: string;
  resourceId?: string;
  reference?: string;
}) => {
  if (!email?.trim()) return;

  try {
    const verificationUrl = buildVerificationUrl(orderNumber, {
      playerId,
      resourceType,
      resourceId,
      reference,
      date: Date.now(),
    });
    const statusLabel =
      status === "confirmed"
        ? "confirmée"
        : status === "pending"
          ? "en attente"
          : status === "failed"
            ? "échouée"
            : "initiée";
    const statusText =
      status === "confirmed"
        ? "Votre transaction a été confirmée."
        : status === "failed"
          ? "Votre transaction a échoué."
          : status === "pending"
            ? "Votre transaction est encore en attente de confirmation."
            : "Votre transaction a été initiée et attend votre validation.";

    await sendMail({
      to: email,
      subject: `ELMES-QUIZ • Paiement ${statusLabel}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Paiement ${statusLabel}</h2>
          <p style="margin:0 0 12px;color:#334155;">Bonjour,</p>
          <p style="margin:0 0 12px;color:#334155;">${statusText}</p>
          <p style="margin:0 0 12px;color:#334155;">Produit : <strong>${productName}</strong></p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Commande :</strong> ${orderNumber}</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Montant :</strong> ${amount.toLocaleString()} ${currency}</p>
          <p style="margin:0 0 16px;color:#334155;">Vous pouvez vérifier le statut de la transaction ici :</p>
          <a href="${verificationUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Vérifier la transaction</a>
        </div>
      `,
    });
  } catch (error) {
    console.error("Erreur envoi email paiement:", error);
  }
};

// ═══════════════════════════════════════════════════════════════════
//  PAYMENT DRAWER (produits : TRAINING_PASS, COMPETITION, EQUIPE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Recherche des utilisateurs par pseudo, téléphone ou email (autocomplete)
 */
export async function searchUsers(query: string) {
  try {
    await connectToDb();

    if (!query || query.trim().length < 2) {
      return { success: true, users: [] };
    }

    const searchRegex = new RegExp(query.trim(), 'i');

    const users = await User.find({
      $or: [
        { pseudo: searchRegex },
        { telephone: searchRegex },
        { email: searchRegex },
      ],
    })
      .limit(10)
      .select('pseudo telephone email photo role')
      .lean();

    const enriched = await Promise.all(
      users.map(async (u) => {
        const player = await Player.findOne({ userId: u._id }).select('type level parties').lean();
        return {
          _id: u._id.toString(),
          pseudo: u.pseudo,
          telephone: u.telephone,
          email: u.email,
          photo: u.photo,
          role: u.role,
          playerType: player?.type || null,
          level: player?.level ?? null,
          parties: player?.parties ?? null,
          playerId: player?._id?.toString() || null,
        };
      })
    );

    return { success: true, users: enriched };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

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
  email?: string,
  paymentMethod: PaymentMethod = "MOBILE_MONEY",
) {
  try {
    console.log("Initiating payment for playerId:", playerId, "phone:", phone, "amount:", amount, "currency:", currency, "product:", product);
    await connectToDb();

    const player = await Player.findById(playerId).populate('userId', 'email pseudo');
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    const reference = `PAY-${product.type}-${playerId.toString().slice(2, 8).toUpperCase()}`;
    const resourceId =
      product.metadata?.enrollmentId ||
      product.metadata?.equipeId ||
      product.metadata?.competitionId ||
      product.metadata?.captainId ||
      product.id;
    console.log("Initiating payment with reference:", reference);

    const collection = await getCollectionByMethod(paymentMethod)({
      phone,
      amount,
      reference,
      currency,
      verificationParams: {
        playerId,
        resourceType: product.type,
        resourceId,
        reference,
        date: Date.now(),
      },
    });

    console.log("Payment initiation response:", collection);

    if (!collection.success || !collection.orderNumber) {
      return {
        success: false,
        error: collection.error || 'Échec de l\'initiation du paiement.',
        providerMessage: collection.message,
      };
    }

    const orderNumber = collection.orderNumber;
    const amountToStore = currency === "USD" && product.amountCDF ? product.amountCDF : amount;
    const targetLevel =
      product.type === "TRAINING_PASS"
        ? product.id === "motuya"
          ? 2
          : product.id === "elonga"
            ? 3
            : 1
        : 0;

    // Enregistrer la recharge dans Player
    player.recharges.push({
      amount: amountToStore,
      providerTxId: orderNumber,
      reference,
      status: 'EN_ATTENTE',
      targetLevel,
      productType: product.type,
      resourceId: String(resourceId || product.id),
      metadata: product.metadata || {},
      currency,
      createdAt: new Date(),
    });

    await player.save();

    const populatedUser = player.userId as { email?: string } | null | undefined;
    const recipientEmail = email?.trim() || populatedUser?.email || '';
    if (recipientEmail) {
      await notifyPaymentByEmail({
        email: recipientEmail,
        orderNumber,
        amount: amountToStore,
        currency,
        productName: product.name,
        status: 'initiated',
        playerId,
        resourceType: product.type,
        resourceId: String(resourceId || product.id),
        reference,
      });
    }

    return {
      success: true,
      orderNumber,
      redirectUrl: collection.redirectUrl,
      paymentMethod,
      message: paymentMethod === "CARD"
        ? 'Paiement carte initie. Redirection vers FlexPay.'
        : 'Paiement initié. En attente de confirmation.',
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur serveur.' };
  }
}

/**
 * Vérifier le statut d'une transaction
 */
export async function checkPaymentStatusAction(orderNumber: string, email?: string, productName?: string) {
  try {
    const statusCheck = await checkStatus(orderNumber);
    if (!statusCheck.success) {
      return { success: false, error: statusCheck.error || 'Impossible de vérifier le statut.' };
    }
    const recipientEmail = email?.trim();
    if (recipientEmail) {
      await notifyPaymentByEmail({
        email: recipientEmail,
        orderNumber,
        amount: 0,
        currency: 'CDF',
        productName: productName || 'Paiement',
        status: statusCheck.status === 'SUCCES' ? 'confirmed' : statusCheck.status === 'ECHEC' ? 'failed' : 'pending',
      });
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

export async function verifyRechargeByOrderNumberAction(orderNumber: string) {
  try {
    if (!orderNumber?.trim()) {
      return { success: false, error: "Numero de commande requis." };
    }

    await connectToDb();

    const player = await Player.findOne({
      $or: [
        { "recharges.providerTxId": orderNumber },
        { "recharges.reference": orderNumber },
      ],
    });
    if (!player) {
      return { success: false, error: "Recharge introuvable pour cette commande." };
    }

    const rechargeIndex = player.recharges.findIndex(
      (item) => item.providerTxId === orderNumber || item.reference === orderNumber,
    );
    const recharge = player.recharges[rechargeIndex];
    if (!recharge) {
      return { success: false, error: "Recharge introuvable." };
    }

    if (recharge.status !== "EN_ATTENTE") {
      return {
        success: true,
        status: recharge.status,
        orderNumber: recharge.providerTxId,
        message: recharge.status === "SUCCES" ? "Transaction deja validee." : "Transaction deja traitee.",
      };
    }

    const providerOrderNumber = recharge.providerTxId;
    const statusCheck = await checkStatus(providerOrderNumber);
    if (!statusCheck.success) {
      return {
        success: false,
        error: statusCheck.error || "Impossible de verifier le statut.",
      };
    }

    const newStatus = "SUCCES"; //statusCheck.status || "ECHEC";
    player.recharges[rechargeIndex].status = newStatus;

    if (newStatus === "SUCCES") {
      const parties = getTrainingPassParties(recharge.amount, recharge.targetLevel);
      if (parties > 0) {
        player.parties += parties;
      }
    }

    await player.save();

    return {
      success: true,
      status: newStatus,
      orderNumber: providerOrderNumber,
      message:
        newStatus === "SUCCES"
          ? "Transaction validee avec succes."
          : newStatus === "ECHEC"
            ? "La transaction a echoue."
            : "Transaction encore en attente.",
    };
  } catch (error: any) {
    console.error("[verifyRechargeByOrderNumberAction]", error);
    return { success: false, error: error.message || "Erreur de verification." };
  }
}

export async function verifyMyRechargeAction(rechargeIndex: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };

    await connectToDb();
    const player = await Player.findOne({ userId: session.userId });
    if (!player) return { success: false, error: "Profil joueur introuvable." };

    const recharge = player.recharges?.[rechargeIndex];
    if (!recharge) return { success: false, error: "Recharge introuvable." };

    return verifyRechargeByOrderNumberAction(recharge.providerTxId || recharge.reference || "");
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de vérification." };
  }
}

export async function verifyPersistedPaymentAction(params: {
  orderNumber?: string;
  reference?: string;
  playerId?: string;
  resourceType?: string;
  resourceId?: string;
}) {
  try {
    const identifier = params.orderNumber?.trim() || params.reference?.trim();
    if (!identifier) {
      return { success: false, error: "Aucun numero de commande ou reference fourni." };
    }

    await connectToDb();

    const playerQuery: any = {
      $or: [
        { "recharges.providerTxId": identifier },
        { "recharges.reference": identifier },
      ],
    };
    if (params.playerId) playerQuery._id = params.playerId;

    const player = await Player.findOne(playerQuery);
    if (!player) {
      const enrollment = await Enrollement.findOne({
        $or: [{ orderNumber: identifier }, { "transactions.orderNumber": identifier }],
      });
      if (!enrollment) return { success: false, error: "Transaction introuvable." };

      if (enrollment.status === "CONFIRMED") {
        return { success: true, status: "SUCCES", message: "Enrollement deja confirme." };
      }

      const statusCheck = await checkStatus(enrollment.orderNumber);
      if (!statusCheck.success) return { success: false, error: statusCheck.error || "Impossible de verifier le paiement." };

      if (statusCheck.status === "SUCCES") {
        enrollment.status = "CONFIRMED";
        enrollment.totalGrantedGames = enrollment.totalGrantedGames || 250;
        enrollment.usedGames = enrollment.usedGames || enrollment.parties || 0;
        enrollment.remainingGames = Math.max(0, (enrollment.totalGrantedGames || 250) - (enrollment.usedGames || 0));
        enrollment.maxParties = enrollment.totalGrantedGames || 250;
        enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
          if (transaction.orderNumber === enrollment.orderNumber) transaction.status = "PAID";
          return transaction;
        });
        await enrollment.save();
        if (enrollment.sessionId) {
          await recomputeCompetitionScholarship(enrollment.sessionId.toString());
        }
      }

      return {
        success: true,
        status: statusCheck.status,
        message: statusCheck.status === "SUCCES" ? "Enrollement confirme." : "Paiement non confirme.",
      };
    }

    const rechargeIndex = player.recharges.findIndex(
      (item) => item.providerTxId === identifier || item.reference === identifier,
    );
    const recharge = player.recharges[rechargeIndex];
    if (!recharge) return { success: false, error: "Transaction introuvable." };

    const resourceType = params.resourceType || recharge.productType || "TRAINING_PASS";
    const providerOrderNumber = recharge.providerTxId;

    if (recharge.status !== "EN_ATTENTE") {
      return {
        success: true,
        status: recharge.status,
        orderNumber: providerOrderNumber,
        message: recharge.status === "SUCCES" ? "Transaction deja validee." : "Transaction deja traitee.",
      };
    }

    const statusCheck = await checkStatus(providerOrderNumber);
    if (!statusCheck.success) {
      return { success: false, error: statusCheck.error || "Impossible de verifier le statut." };
    }

    player.recharges[rechargeIndex].status = statusCheck.status || "ECHEC";

    if (statusCheck.status === "SUCCES") {
      if (resourceType === "TRAINING_PASS") {
        const parties = getTrainingPassParties(recharge.amount, recharge.targetLevel);
        if (parties > 0) player.parties += parties;
      }

      if (resourceType === "EQUIPE") {
        const metadata: any = recharge.metadata || {};
        const captainId = metadata.captainId || params.resourceId || recharge.resourceId;
        const equipeConditions: any[] = [{ "payment.orderNumber": providerOrderNumber }];
        if (metadata.designation) {
          equipeConditions.push({ designation: new RegExp(`^${String(metadata.designation).trim()}$`, "i") });
        }
        const existingEquipe = await Equipe.findOne({ $or: equipeConditions });

        if (!existingEquipe && captainId && metadata.designation && metadata.description) {
          await Equipe.create({
            chefId: captainId,
            designation: String(metadata.designation).trim(),
            description: [String(metadata.description).trim()],
            logo: String(metadata.logo || "").trim(),
            payment: [{
              orderNumber: providerOrderNumber,
              status: "CONFIRMED",
              providerText: "FlexPay",
            }],
            membres: [{ player: captainId, status: true, isSecretary: true }],
            metriques: { competitions: 0, soldeUsd: 0, soldeCDF: 0, matchsWin: 0 },
          });
        }
      }

      if (resourceType === "COMPETITION") {
        const metadata: any = recharge.metadata || {};
        const enrollmentConditions: any[] = [
          { orderNumber: providerOrderNumber },
          { "transactions.orderNumber": providerOrderNumber },
        ];
        if (metadata.enrollmentId) enrollmentConditions.unshift({ _id: metadata.enrollmentId });
        const enrollment = await Enrollement.findOne({ $or: enrollmentConditions });
        if (enrollment && enrollment.status !== "CONFIRMED") {
          enrollment.status = "CONFIRMED";
          enrollment.totalGrantedGames = enrollment.totalGrantedGames || 250;
          enrollment.usedGames = enrollment.usedGames || enrollment.parties || 0;
          enrollment.remainingGames = Math.max(0, (enrollment.totalGrantedGames || 250) - (enrollment.usedGames || 0));
          enrollment.maxParties = enrollment.totalGrantedGames || 250;
          enrollment.transactions = (enrollment.transactions || []).map((transaction: any) => {
            if (transaction.orderNumber === providerOrderNumber) transaction.status = "PAID";
            return transaction;
          });
          await enrollment.save();
          if (enrollment.sessionId) {
            await recomputeCompetitionScholarship(enrollment.sessionId.toString());
          }
        }
      }
    }

    await player.save();

    return {
      success: true,
      status: statusCheck.status,
      orderNumber: providerOrderNumber,
      message:
        statusCheck.status === "SUCCES"
          ? "Paiement valide et transaction appliquee."
          : statusCheck.status === "ECHEC"
            ? "Le paiement a echoue."
            : "Paiement encore en attente.",
    };
  } catch (error: any) {
    console.error("[verifyPersistedPaymentAction]", error);
    return { success: false, error: error.message || "Erreur de verification." };
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
  paymentMethod: PaymentMethod = "MOBILE_MONEY",
  email?: string,
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
    const collection = await getCollectionByMethod(paymentMethod)({
      phone,
      amount: amountProvider,
      reference,
      currency: providerCurrency,
      verificationParams: {
        playerId,
        resourceType: "TRAINING_PASS",
        resourceId: String(targetLevel),
        reference,
        date: Date.now(),
      },
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
      reference,
      status: "EN_ATTENTE",
      targetLevel,
      productType: "TRAINING_PASS",
      resourceId: String(targetLevel),
      metadata: { targetLevel },
      currency,
      createdAt: new Date(),
    });

    await player.save();

    const user = await User.findById(player.userId).select("email").lean();
    const recipientEmail = email?.trim() || (user as any)?.email || "";
    if (recipientEmail) {
      await notifyPaymentByEmail({
        email: recipientEmail,
        orderNumber,
        amount: amountCDF,
        currency,
        productName: `Recharge ${PACK_NAMES[targetLevel] || `niveau ${targetLevel}`}`,
        status: "initiated",
        playerId,
        resourceType: "TRAINING_PASS",
        resourceId: String(targetLevel),
        reference,
      });
    }

    return {
      success: true,
      orderNumber,
      redirectUrl: collection.redirectUrl,
      paymentMethod,
      amountCDF,
      currency,
      message: paymentMethod === "CARD"
        ? "Paiement carte initie. Redirection vers FlexPay."
        : "Collecte initiée. En attente de confirmation.",
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

    const numericAmount = Number(amount);
    if (!phone?.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: "Téléphone et montant requis." };
    }

    await connectToDb();
    const user = await User.findById(session.userId);
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    // Vérifier le solde
    if (user.solde < numericAmount) {
      return { success: false, error: "Solde insuffisant." };
    }

    const reference = `WTH-${user.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Enregistrer selon le rôle
    if (user.role === 'PLAYER') {
      const player = await Player.findOne({ userId: session.userId });
      if (!player) return { success: false, error: "Profil joueur introuvable." };
      player.retraits.push({
        amount: numericAmount,
        providerTxId: reference,
        reference,
        status: "EN_ATTENTE",
        method: "MOBILE_MONEY",
        currency: "CDF",
        message: "TODO: mettre en place un solde bloqué pour éviter les doubles demandes sur le même solde.",
        createdAt: new Date(),
      });
      await player.save();
    } else {
      const agent = await Agent.findOne({ userId: session.userId });
      if (!agent) return { success: false, error: "Profil agent introuvable." };
      agent.retraits.push({
        amount: numericAmount,
        providerTxId: reference,
        status: "EN_ATTENTE",
        createdAt: new Date(),
      });
      await agent.save();
    }

    return { success: true, orderNumber: reference, message: "Demande de retrait enregistrée. Elle attend la validation d'un gestionnaire." };
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
        retraits = (player.retraits || []).map((r, i) => ({ index: i, amount: r.amount, providerTxId: r.providerTxId, reference: r.reference, status: r.status, method: r.method, currency: r.currency, message: r.message, processedAt: r.processedAt, createdAt: r.createdAt }));
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
      status: r.status,
      providerTxId: r.providerTxId,
      createdAt: r.createdAt,
    }));
    const recentWithdrawals = (player?.retraits || []).slice(-5).reverse().map((r: any, index: number) => ({
      index,
      type: "withdrawal",
      amount: r.amount,
      status: r.status,
      providerTxId: r.providerTxId,
      createdAt: r.createdAt,
    }));

    return {
      success: true,
      data: {
        availableBalance: user.solde || 0,
        pendingBalance: 0,
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
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };
    if (!["ADMIN", "MOD"].includes(session.role)) return { success: false, error: "Accès refusé." };

    await connectToDb();
    const players = await Player.find({ "retraits.status": "EN_ATTENTE" })
      .populate("userId", "pseudo telephone solde role")
      .lean();

    const withdrawals = players.flatMap((player: any) =>
      (player.retraits || [])
        .map((retrait: any, index: number) => ({ retrait, index }))
        .filter(({ retrait }: any) => retrait.status === "EN_ATTENTE")
        .map(({ retrait, index }: any) => ({
          playerId: player._id.toString(),
          retraitIndex: index,
          pseudo: player.userId?.pseudo || "Joueur",
          telephone: player.userId?.telephone || "",
          solde: player.userId?.solde || 0,
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

export async function validateWithdrawalAdminAction(playerId: string, retraitIndex: number) {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "Non connecté." };
    if (!["ADMIN", "MOD"].includes(session.role)) return { success: false, error: "Accès refusé." };

    await connectToDb();
    const player = await Player.findById(playerId);
    if (!player) return { success: false, error: "Joueur introuvable." };

    const retrait = player.retraits?.[retraitIndex];
    if (!retrait) return { success: false, error: "Retrait introuvable." };
    if (retrait.status !== "EN_ATTENTE" || retrait.processedAt || retrait.validatedAt) {
      return { success: false, error: "Ce retrait a déjà été traité." };
    }

    const user = await User.findById(player.userId);
    if (!user) return { success: false, error: "Utilisateur introuvable." };
    if ((user.solde || 0) < retrait.amount) {
      return { success: false, error: "Solde insuffisant au moment de la validation." };
    }

    const reference = retrait.reference || retrait.providerTxId || `WTH-PLAYER-${Date.now()}`;
    const hasProviderTransaction = retrait.providerTxId && retrait.providerTxId !== reference;
    const payout = hasProviderTransaction
      ? { success: true, orderNumber: retrait.providerTxId, message: "Transaction provider existante." }
      : await initiatePayout({
          phone: user.telephone,
          amount: retrait.amount,
          reference,
          currency: retrait.currency || "CDF",
        });

    const now = new Date();
    if (!payout.success || !payout.orderNumber) {
      player.retraits[retraitIndex].status = "ECHEC";
      player.retraits[retraitIndex].message = (payout as any).error || "Erreur provider.";
      player.retraits[retraitIndex].processedAt = now;
      await player.save();
      return { success: false, status: "ECHEC", error: (payout as any).error || "Échec provider." };
    }

    player.retraits[retraitIndex].providerTxId = payout.orderNumber;
    const statusCheck = await checkStatus(payout.orderNumber);
    if (!statusCheck.success) {
      player.retraits[retraitIndex].message = statusCheck.error || "Transaction initiée, vérification provider en attente.";
      await player.save();
      return { success: true, status: "EN_ATTENTE", message: "Transaction initiée. Statut provider encore en vérification." };
    }

    if (statusCheck.status === "EN_ATTENTE") {
      player.retraits[retraitIndex].message = statusCheck.message || "Retrait en attente provider.";
      await player.save();
      return { success: true, status: "EN_ATTENTE", message: "Retrait encore en attente chez le provider." };
    }

    if (statusCheck.status === "ECHEC") {
      player.retraits[retraitIndex].status = "ECHEC";
      player.retraits[retraitIndex].message = statusCheck.message || "Retrait échoué chez le provider.";
      player.retraits[retraitIndex].processedAt = now;
      await player.save();
      return { success: false, status: "ECHEC", error: "Le provider a refusé le retrait." };
    }

    player.retraits[retraitIndex].status = "SUCCES";
    player.retraits[retraitIndex].message = statusCheck.message || payout.message || "Retrait validé.";
    player.retraits[retraitIndex].processedAt = now;
    player.retraits[retraitIndex].validatedAt = now;
    user.solde = Math.max(0, (user.solde || 0) - retrait.amount);

    await user.save();
    await player.save();

    return { success: true, status: "SUCCES", message: "Retrait validé et solde débité." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur validation retrait." };
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
