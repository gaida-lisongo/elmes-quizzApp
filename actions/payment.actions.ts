'use server';

import connectToDb from "@/lib/utils/db";
import User from "@/lib/models/User";
import Player from "@/lib/models/Player";
import { initiateCollection, checkStatus } from "@/lib/utils/payment.service";

export type ProductPayload = {
  id: string;
  name: string;
  amountCDF: number;
  amountUSD?: number;
  type: 'TRAINING_PASS' | 'COMPETITION' | 'EQUIPE';
  metadata?: Record<string, any>;
};

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