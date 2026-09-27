import 'server-only';
import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import User from '@/lib/models/User';
import Player, { type IPlayer, type IRecharge } from '@/lib/models/Player';
import Equipe from '@/lib/models/Equipe';
import EnrollementModule from '@/lib/models/Enrollement';
import { initiateCollection, initialCard, checkStatus } from '@/lib/utils/payment.service';
import { sendMail } from '@/lib/utils/mail';
import { escapeHtml } from '@/lib/utils/security';
import { tx, withTransaction } from '@/lib/utils/transaction';
import { getTrainingPass, type Currency, type ProductType } from '@/lib/payments/pricing';
import { cancelPendingEnrollment, confirmEnrollment } from '@/lib/services/enrollment.service';

const { Enrollement } = EnrollementModule;

export type PaymentMethod = 'MOBILE_MONEY' | 'CARD';
export type PaymentStatus = 'EN_ATTENTE' | 'SUCCES' | 'ECHEC' | 'A_VERIFIER';

export type ReferenceType = ProductType | 'RETRAIT' | 'AGENT';

const REFERENCE_TYPE: Record<ReferenceType, string> = {
  TRAINING_PASS: 'PASS',
  PARCOURS: 'PARCOURS',
  COMPETITION: 'COMPETITION',
  EQUIPE: 'EQUIPE',
  RETRAIT: 'RETRAIT',
  AGENT: 'AGENT',
};

/** Référence unique par transaction (PAY-07) : ELQ-{TYPE}-{yyyymmdd}-{8 caractères aléatoires}. */
export function generatePaymentReference(type: ReferenceType): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase().padEnd(8, 'X');
  return `ELQ-${REFERENCE_TYPE[type]}-${date}-${random}`;
}

const buildVerificationUrl = (orderNumber: string) => {
  const baseUrl =
    process.env.PAYMENT_VERIFICATION_URL ||
    process.env.NEXT_PUBLIC_PAYMENT_VERIFICATION_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'https://elmes-quiz.com';
  const search = new URLSearchParams({ type: 'email', orderNumber });
  return `${baseUrl.replace(/\/$/, '')}/payment/verification?${search.toString()}`;
};

/**
 * E-mail de suivi de paiement, envoyé uniquement à l'adresse du compte (SEC-19),
 * avec toutes les valeurs échappées.
 */
export async function notifyPaymentByEmail(params: {
  email?: string | null;
  orderNumber: string;
  amount: number;
  currency: Currency;
  productName: string;
  status: 'initiated' | 'confirmed' | 'pending' | 'failed';
}) {
  if (!params.email?.trim()) return;
  try {
    const statusLabel = { confirmed: 'confirmé', pending: 'en attente', failed: 'échoué', initiated: 'initié' }[params.status];
    const statusText = {
      confirmed: 'Votre transaction a été confirmée.',
      failed: 'Votre transaction a échoué.',
      pending: 'Votre transaction est encore en attente de confirmation.',
      initiated: 'Votre transaction a été initiée et attend votre validation.',
    }[params.status];

    await sendMail({
      to: params.email,
      subject: `ELMES-QUIZ • Paiement ${statusLabel}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Paiement ${escapeHtml(statusLabel)}</h2>
          <p style="margin:0 0 12px;color:#334155;">Bonjour,</p>
          <p style="margin:0 0 12px;color:#334155;">${escapeHtml(statusText)}</p>
          <p style="margin:0 0 12px;color:#334155;">Produit : <strong>${escapeHtml(params.productName)}</strong></p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Commande :</strong> ${escapeHtml(params.orderNumber)}</p>
          <p style="margin:0 0 12px;color:#334155;"><strong>Montant :</strong> ${escapeHtml(params.amount.toLocaleString('fr-FR'))} ${escapeHtml(params.currency)}</p>
          <p style="margin:0 0 16px;color:#334155;">Vous pouvez vérifier le statut de la transaction ici :</p>
          <a href="${escapeHtml(buildVerificationUrl(params.orderNumber))}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Vérifier la transaction</a>
        </div>
      `,
    });
  } catch (error: any) {
    console.error('Erreur envoi email paiement:', error?.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  INITIATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Journal de diagnostic des paiements, sans donnée personnelle (ni téléphone, ni e-mail) :
 * uniquement références, montants, statuts et messages du fournisseur.
 */
function logPayment(event: string, fields: Record<string, unknown>) {
  const safe = JSON.stringify(fields).replace(/\+?\d{9,15}/g, (m) => (/^\+?(243|0)\d{8,9}$/.test(m) ? '***' : m));
  console.info(`[payment] ${event} ${safe}`);
}

export interface StartPaymentParams {
  payer: IPlayer;                   // Joueur de la session (jamais un identifiant client)
  productType: ProductType;
  productId: string;
  productName: string;
  amount: number;                   // Montant serveur, dans la devise
  currency: Currency;
  amountCDF: number;
  fxRate: number;
  targetLevel?: number;
  phone: string;
  method: PaymentMethod;
  metadata?: Record<string, unknown>;
  beneficiaryPlayerId?: mongoose.Types.ObjectId;
}

/**
 * Initie un encaissement et l'enregistre dans le registre Player.recharges.
 * Le produit, le montant et l'effet sont stockés côté serveur au moment de l'initiation :
 * la vérification ne lit plus rien dans l'URL de retour (PAY-06).
 */
export async function startPayment(params: StartPaymentParams): Promise<
  | { success: true; orderNumber: string; reference: string; redirectUrl?: string }
  | { success: false; error: string; providerMessage?: string }
> {
  const phone = String(params.phone || '').trim();
  if (!/^\+?\d{9,15}$/.test(phone.replace(/\s/g, ''))) {
    return { success: false, error: 'Numéro Mobile Money invalide.' };
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    return { success: false, error: 'Montant invalide.' };
  }

  const reference = generatePaymentReference(params.productType);
  const provider = params.method === 'CARD' ? initialCard : initiateCollection;
  const collection = await provider({
    phone: phone.replace(/\s/g, ''),
    amount: params.amount,
    reference,
    currency: params.currency,
    verificationParams: { reference },
  });

  logPayment('start', {
    reference,
    productType: params.productType,
    method: params.method,
    currency: params.currency,
    amount: params.amount,
    ok: collection.success && Boolean(collection.orderNumber),
    orderNumber: collection.orderNumber,
    providerCode: collection.raw?.code,
    providerMessage: collection.error || collection.message,
  });

  if (!collection.success || !collection.orderNumber) {
    return {
      success: false,
      error: collection.error || 'Échec de l’initiation du paiement.',
      providerMessage: collection.message,
    };
  }

  const recharge: Partial<IRecharge> = {
    amount: params.amount,
    currency: params.currency,
    amountCDF: params.amountCDF,
    fxRate: params.fxRate,
    providerTxId: collection.orderNumber,
    reference,
    status: 'EN_ATTENTE',
    targetLevel: params.targetLevel ?? 0,
    productType: params.productType,
    productId: params.productId,
    resourceId: params.productId,
    metadata: params.metadata || {},
    beneficiaryPlayerId: params.beneficiaryPlayerId,
    createdAt: new Date(),
  };

  // $push atomique : plus de save() concurrent sur le document Player.
  await Player.updateOne({ _id: params.payer._id }, { $push: { recharges: recharge } });

  const user = await User.findById(params.payer.userId).select('email').lean();
  await notifyPaymentByEmail({
    email: user?.email,
    orderNumber: collection.orderNumber,
    amount: params.amount,
    currency: params.currency,
    productName: params.productName,
    status: 'initiated',
  });

  return { success: true, orderNumber: collection.orderNumber, reference, redirectUrl: collection.redirectUrl };
}

// ═══════════════════════════════════════════════════════════════════
//  VÉRIFICATION ET APPLICATION (flux unique)
// ═══════════════════════════════════════════════════════════════════

export interface VerifyResult {
  success: boolean;
  status?: PaymentStatus;
  orderNumber?: string;
  productType?: string;
  message?: string;
  error?: string;
}

/** Parties d'un pack : catalogue serveur, ou ancienne règle pour les recharges historiques. */
function resolvePassParties(recharge: IRecharge): number {
  const pass = getTrainingPass(recharge.productId);
  if (pass) return pass.parties;
  const amountCDF = Number(recharge.amountCDF ?? recharge.amount);
  if (amountCDF === 2500 || recharge.targetLevel === 1) return 15;
  if (amountCDF === 7000 || recharge.targetLevel === 2) return 40;
  if (amountCDF === 15000 || recharge.targetLevel === 3) return 130;
  return 0;
}

/** Effet d'un paiement confirmé, selon le produit enregistré en base. Appelé dans la transaction. */
async function applyPaymentEffect(
  player: IPlayer,
  recharge: IRecharge,
  dbSession: mongoose.ClientSession | null,
): Promise<{ enrollmentId?: string; enrollmentConfirmed?: boolean }> {
  const metadata: any = recharge.metadata || {};

  switch (recharge.productType) {
    case 'TRAINING_PASS': {
      const parties = resolvePassParties(recharge);
      if (parties <= 0) throw new Error('Pack inconnu : impossible de créditer les parties.');
      const beneficiaryId = recharge.beneficiaryPlayerId || player._id;
      await Player.updateOne({ _id: beneficiaryId }, { $inc: { parties } }, tx(dbSession));
      await Player.updateOne(
        { _id: player._id, 'recharges._id': recharge._id },
        { $set: { 'recharges.$.creditedParties': parties, 'recharges.$.creditedAt': new Date() } },
        tx(dbSession),
      );
      return {};
    }

    case 'PARCOURS':
    case 'COMPETITION': {
      let enrollmentId = metadata.enrollmentId ? String(metadata.enrollmentId) : '';
      if (!enrollmentId) {
        const legacy = await Enrollement.findOne({
          $or: [{ orderNumber: recharge.providerTxId }, { 'transactions.orderNumber': recharge.providerTxId }],
        }).session(dbSession).select('_id').lean();
        enrollmentId = legacy?._id?.toString() || '';
      }
      if (!enrollmentId) throw new Error('Enrôlement lié au paiement introuvable.');
      const result = await confirmEnrollment(
        enrollmentId,
        {
          orderNumber: recharge.providerTxId,
          paidAmount: recharge.amount,
          paidCurrency: recharge.currency,
          paidAmountCDF: recharge.amountCDF ?? recharge.amount,
          fxRate: recharge.fxRate ?? 1,
        },
        dbSession,
      );
      return { enrollmentId, enrollmentConfirmed: result.confirmed };
    }

    case 'EQUIPE': {
      // Création unique de l'équipe, au nom du payeur (capitaine = joueur de la session à l'initiation).
      const existing = await Equipe.findOne({ 'payment.orderNumber': recharge.providerTxId }).session(dbSession).lean();
      if (existing) return {};
      const designation = String(metadata.designation || '').trim();
      if (!designation) throw new Error('Désignation d’équipe manquante.');
      await Equipe.create([{
        chefId: player._id,
        designation,
        description: [String(metadata.description || '').trim()].filter(Boolean),
        logo: String(metadata.logo || '').trim(),
        payment: [{ orderNumber: recharge.providerTxId, status: 'CONFIRMED', providerText: 'FlexPay' }],
        membres: [{ player: player._id, status: true, isSecretary: true }],
        metriques: { competitions: 0, soldeUsd: 0, soldeCDF: 0, matchsWin: 0 },
      }], tx(dbSession));
      return {};
    }

    default:
      throw new Error('Type de produit inconnu.');
  }
}

async function findRecharge(identifier: string) {
  const player = await Player.findOne({
    $or: [{ 'recharges.providerTxId': identifier }, { 'recharges.reference': identifier }],
  });
  if (!player) return null;
  const recharge = player.recharges.find((item) => item.providerTxId === identifier || item.reference === identifier);
  return recharge ? { player, recharge } : null;
}

/**
 * Point unique de vérification d'un paiement (callback, page de retour, bouton « vérifier »,
 * vérification par un gestionnaire). Idempotent : l'effet n'est appliqué qu'une fois.
 * @param options.ownerPlayerId restreint la vérification aux paiements de ce joueur.
 */
export async function verifyAndApplyPayment(
  identifier: string,
  options: { ownerPlayerId?: string } = {},
): Promise<VerifyResult> {
  const id = String(identifier || '').trim();
  if (!id || id.length > 120) return { success: false, error: 'Aucun numéro de commande ou référence fourni.' };

  await connectToDb();

  const found = await findRecharge(id);
  if (!found) {
    return verifyLegacyEnrollment(id);
  }

  const { player, recharge } = found;
  if (options.ownerPlayerId && player._id.toString() !== options.ownerPlayerId) {
    return { success: false, error: 'Transaction introuvable.' };
  }

  const orderNumber = recharge.providerTxId;
  const base = { orderNumber, productType: recharge.productType };

  if (recharge.status === 'SUCCES') {
    return { success: true, status: 'SUCCES', ...base, message: 'Transaction déjà validée.' };
  }
  if (recharge.status === 'ECHEC') {
    return { success: true, status: 'ECHEC', ...base, message: 'Transaction déjà traitée : paiement échoué.' };
  }
  if (recharge.status === 'A_VERIFIER') {
    return { success: true, status: 'A_VERIFIER', ...base, message: 'Transaction en cours de vérification par un gestionnaire.' };
  }

  const statusCheck = await checkStatus(orderNumber);
  logPayment('verify', {
    orderNumber,
    reference: recharge.reference,
    productType: recharge.productType,
    expected: `${recharge.amount} ${recharge.currency || ''}`.trim(),
    ok: statusCheck.success,
    providerStatus: statusCheck.status,
    providerCode: statusCheck.raw?.code,
    providerAmount: statusCheck.raw?.amount,
    providerCurrency: statusCheck.raw?.currency,
    providerMessage: statusCheck.error || statusCheck.message,
  });
  if (!statusCheck.success) {
    return { success: false, ...base, error: statusCheck.error || 'Impossible de vérifier le statut.' };
  }

  if (statusCheck.status === 'EN_ATTENTE' || !statusCheck.status) {
    return { success: true, status: 'EN_ATTENTE', ...base, message: 'Paiement encore en attente.' };
  }

  if (statusCheck.status === 'ECHEC') {
    await withTransaction(async (dbSession) => {
      const res = await Player.updateOne(
        { _id: player._id, recharges: { $elemMatch: { _id: recharge._id, status: 'EN_ATTENTE' } } },
        { $set: { 'recharges.$.status': 'ECHEC', 'recharges.$.failureReason': statusCheck.message || 'Refusé par le fournisseur' } },
        tx(dbSession),
      );
      const enrollmentId = (recharge.metadata as any)?.enrollmentId;
      if (res.modifiedCount && enrollmentId) await cancelPendingEnrollment(String(enrollmentId), orderNumber, dbSession);
    });
    return { success: true, status: 'ECHEC', ...base, message: 'Le paiement a échoué.' };
  }

  // SUCCES : comparer le montant payé au montant attendu.
  // Seul un paiement inférieur au montant attendu (ou dans une autre devise) est bloqué : un montant
  // supérieur peut inclure des frais du fournisseur.
  // TODO(lot 4): confirmer le champ du montant renvoyé par le fournisseur (raw.amount ici) ; s'il est
  // absent, le contrôle repose sur le montant serveur envoyé à l'initiation.
  const providerAmount = Number(statusCheck.raw?.amount);
  const providerCurrency = String(statusCheck.raw?.currency || '').toUpperCase();
  const amountMismatch =
    (Number.isFinite(providerAmount) && providerAmount > 0 && providerAmount + 0.01 < recharge.amount) ||
    (['CDF', 'USD'].includes(providerCurrency) && Boolean(recharge.currency) && providerCurrency !== recharge.currency);
  if (amountMismatch) {
    await Player.updateOne(
      { _id: player._id, recharges: { $elemMatch: { _id: recharge._id, status: 'EN_ATTENTE' } } },
      {
        $set: {
          'recharges.$.status': 'A_VERIFIER',
          'recharges.$.providerAmount': providerAmount,
          'recharges.$.failureReason': `Montant payé (${providerAmount} ${providerCurrency || '?'}) différent du montant attendu (${recharge.amount} ${recharge.currency}).`,
        },
      },
    );
    return { success: true, status: 'A_VERIFIER', ...base, message: 'Montant payé différent du montant attendu : transaction à vérifier par un gestionnaire.' };
  }

  let effect: { enrollmentId?: string; enrollmentConfirmed?: boolean } = {};
  let applied = false;
  await withTransaction(async (dbSession) => {
    try {
    // Verrou : EN_ATTENTE → SUCCES + appliedAt, posé une seule fois.
    const locked = await Player.findOneAndUpdate(
      { _id: player._id, recharges: { $elemMatch: { _id: recharge._id, status: 'EN_ATTENTE', appliedAt: { $exists: false } } } },
      {
        $set: {
          'recharges.$.status': 'SUCCES',
          'recharges.$.appliedAt': new Date(),
          ...(Number.isFinite(providerAmount) && providerAmount > 0 ? { 'recharges.$.providerAmount': providerAmount } : {}),
        },
      },
      { new: true, ...tx(dbSession) },
    );
    applied = Boolean(locked);
    if (!locked) return;
    effect = await applyPaymentEffect(locked, recharge, dbSession);
    } catch (error: any) {
      logPayment('apply-error', { orderNumber, productType: recharge.productType, error: error?.message });
      throw error;
    }
  });
  logPayment('applied', { orderNumber, productType: recharge.productType, applied, enrollmentConfirmed: effect.enrollmentConfirmed });

  if (!applied) {
    return { success: true, status: 'SUCCES', ...base, message: 'Transaction déjà validée.' };
  }

  // E-mails après la transaction
  const user = await User.findById(player.userId).select('email').lean();
  await notifyPaymentByEmail({
    email: user?.email,
    orderNumber,
    amount: recharge.amount,
    currency: (recharge.currency || 'CDF') as Currency,
    productName: productLabel(recharge),
    status: 'confirmed',
  });
  if (effect.enrollmentId && effect.enrollmentConfirmed) {
    const { sendEnrollmentConfirmationEmail } = await import('@/lib/services/enrollment-mail.service');
    await sendEnrollmentConfirmationEmail(effect.enrollmentId, orderNumber);
  }

  return { success: true, status: 'SUCCES', ...base, message: 'Paiement validé et transaction appliquée.' };
}

function productLabel(recharge: IRecharge) {
  switch (recharge.productType) {
    case 'TRAINING_PASS': return getTrainingPass(recharge.productId)?.name || 'Pass d’entraînement';
    case 'PARCOURS': return 'Enrôlement parcours';
    case 'COMPETITION': return 'Enrôlement compétition';
    case 'EQUIPE': return 'Création d’équipe';
    default: return 'Paiement';
  }
}

/**
 * Enrôlements historiques sans recharge associée : vérification par le numéro de commande de l'enrôlement.
 */
async function verifyLegacyEnrollment(identifier: string): Promise<VerifyResult> {
  const enrollment = await Enrollement.findOne({
    $or: [{ orderNumber: identifier }, { 'transactions.orderNumber': identifier }],
  }).select('_id status orderNumber').lean();
  if (!enrollment) return { success: false, error: 'Transaction introuvable.' };
  if (enrollment.status === 'CONFIRMED') {
    return { success: true, status: 'SUCCES', orderNumber: enrollment.orderNumber, message: 'Enrôlement déjà confirmé.' };
  }

  const statusCheck = await checkStatus(enrollment.orderNumber);
  if (!statusCheck.success) return { success: false, error: statusCheck.error || 'Impossible de vérifier le paiement.' };

  if (statusCheck.status === 'SUCCES') {
    const result = await withTransaction((dbSession) =>
      confirmEnrollment(String(enrollment._id), { orderNumber: enrollment.orderNumber }, dbSession),
    );
    if (result.confirmed) {
      const { sendEnrollmentConfirmationEmail } = await import('@/lib/services/enrollment-mail.service');
      await sendEnrollmentConfirmationEmail(String(enrollment._id), enrollment.orderNumber);
    }
    return { success: true, status: 'SUCCES', orderNumber: enrollment.orderNumber, message: 'Enrôlement confirmé.' };
  }
  if (statusCheck.status === 'ECHEC') {
    await cancelPendingEnrollment(String(enrollment._id), enrollment.orderNumber, null);
    return { success: true, status: 'ECHEC', orderNumber: enrollment.orderNumber, message: 'Le paiement a échoué.' };
  }
  return { success: true, status: 'EN_ATTENTE', orderNumber: enrollment.orderNumber, message: 'Paiement encore en attente.' };
}
