import 'server-only';
import mongoose, { type ClientSession } from 'mongoose';
import EnrollementModule from '@/lib/models/Enrollement';
import { tx } from '@/lib/utils/transaction';
import { grantSessionGamesAfterEnrollmentValidation } from '@/lib/utils/enrollmentGames';
import { recomputeCompetitionScholarship } from '@/lib/utils/scholarship.service';

const { Enrollement } = EnrollementModule;

export interface EnrollmentPaymentInfo {
  orderNumber?: string;
  paidAmount?: number;
  paidCurrency?: 'CDF' | 'USD';
  paidAmountCDF?: number;
  fxRate?: number;
}

/**
 * Confirmation d'un enrôlement, idempotente (EX-PAY-02) :
 * - passage atomique vers CONFIRMED (un seul appelant « gagne ») ;
 * - octroi des 250 parties (verrou gamesGranted) ;
 * - recalcul de la Bourse pour une compétition.
 * À appeler dans une transaction ; les e-mails sont envoyés par l'appelant après validation.
 */
export async function confirmEnrollment(
  enrollmentId: string,
  payment: EnrollmentPaymentInfo,
  dbSession: ClientSession | null,
): Promise<{ confirmed: boolean; alreadyConfirmed: boolean; isCompetition: boolean; sessionId?: string }> {
  if (!mongoose.Types.ObjectId.isValid(String(enrollmentId))) {
    throw new Error('Enrôlement invalide.');
  }

  const set: Record<string, unknown> = {
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    validatedAt: new Date(),
  };
  if (payment.paidAmount !== undefined) set.paidAmount = payment.paidAmount;
  if (payment.paidCurrency) set.paidCurrency = payment.paidCurrency;
  if (payment.paidAmountCDF !== undefined) set.paidAmountCDF = payment.paidAmountCDF;
  if (payment.fxRate !== undefined) set.fxRate = payment.fxRate;

  const hasOrder = Boolean(payment.orderNumber);
  if (hasOrder) set['transactions.$[t].status'] = 'PAID';
  else set['transactions.$[].status'] = 'PAID';

  const updated = await Enrollement.findOneAndUpdate(
    { _id: enrollmentId, status: { $ne: 'CONFIRMED' } },
    { $set: set },
    {
      new: true,
      ...(hasOrder ? { arrayFilters: [{ 't.orderNumber': payment.orderNumber }] } : {}),
      ...tx(dbSession),
    },
  ).lean();

  const current = updated || (await Enrollement.findById(enrollmentId).session(dbSession).lean());
  if (!current) throw new Error('Enrôlement introuvable.');

  const isCompetition = Boolean(current.competitionId);
  const sessionId = current.sessionId?.toString();

  // L'octroi des parties est idempotent : on le rejoue aussi pour un enrôlement déjà confirmé
  // dont les parties n'auraient pas été accordées (reprise après incident).
  await grantSessionGamesAfterEnrollmentValidation(String(current._id), dbSession);

  if (updated && isCompetition && sessionId) {
    const recompute = await recomputeCompetitionScholarship(sessionId, dbSession);
    if (!recompute.success) {
      console.error('[confirmEnrollment] Recalcul de la Bourse impossible :', recompute.error);
    }
  }

  return { confirmed: Boolean(updated), alreadyConfirmed: !updated, isCompetition, sessionId };
}

/** Paiement échoué : l'enrôlement encore en attente est annulé (il ne bloque plus l'unicité). */
export async function cancelPendingEnrollment(enrollmentId: string, orderNumber: string | undefined, dbSession: ClientSession | null) {
  if (!mongoose.Types.ObjectId.isValid(String(enrollmentId))) return;
  await Enrollement.updateOne(
    { _id: enrollmentId, status: 'PENDING' },
    {
      $set: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        ...(orderNumber ? { 'transactions.$[t].status': 'FAILED' } : {}),
      },
    },
    { ...(orderNumber ? { arrayFilters: [{ 't.orderNumber': orderNumber }] } : {}), ...tx(dbSession) },
  );
}
