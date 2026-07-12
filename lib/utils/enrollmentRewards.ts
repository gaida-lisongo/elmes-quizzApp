import mongoose from 'mongoose';
import User from '@/lib/models/User';
import Player from '@/lib/models/Player';
import { Critere } from '@/lib/models/Competition';
import EnrollementModule from '@/lib/models/Enrollement';
import { sendMail } from '@/lib/utils/mail';

const { Enrollement, Session } = EnrollementModule;

const roundAmount = (amount: number) => Math.floor(amount);

async function notifyReward(to: string | undefined, subject: string, amount: number, sessionName: string) {
  if (!to?.trim()) return;
  try {
    await sendMail({
      to,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;background:#f7f9fc;border-radius:16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;">Récompense créditée</h2>
          <p style="margin:0 0 12px;color:#334155;">Votre récompense pour la session <strong>${sessionName}</strong> a été créditée.</p>
          <p style="margin:0;color:#334155;"><strong>Montant :</strong> ${amount.toLocaleString('fr-FR')} CDF</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('[notifyReward]', error);
  }
}

export async function distributeParcoursSessionRewards(sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) return { success: false, error: 'Session introuvable' };
  if (session.rewardsDistributed) {
    return { success: true, skipped: true, message: 'Récompenses déjà distribuées pour cette session.' };
  }

  const critere = await Critere.findOne({ sessionId: new mongoose.Types.ObjectId(sessionId), status: true }).lean();
  const winners = await Enrollement.find({
    sessionId: new mongoose.Types.ObjectId(sessionId),
    parcoursId: { $exists: true, $ne: null },
    playerId: { $exists: true, $ne: null },
    status: 'CONFIRMED',
  })
    .populate({
      path: 'playerId',
      populate: { path: 'userId', select: 'email solde' },
    })
    .sort({ points: -1, updatedAt: 1 })
    .limit(3);

  if (winners.length === 0) return { success: true, distributed: 0, message: 'Aucun joueur éligible.' };

  const amounts = [
    Number((critere as any)?.firstRecompense || 0),
    Number((critere as any)?.secondRecompense || 0),
    Number((critere as any)?.thirdRecompense || 0),
  ];

  const rewardTransactions: any[] = [];
  for (let index = 0; index < winners.length; index += 1) {
    const enrollment: any = winners[index];
    const amount = roundAmount(amounts[index] || 0);
    if (amount <= 0) continue;

    const player: any = enrollment.playerId;
    if (!player?.userId?._id) continue;

    await User.findByIdAndUpdate(player.userId._id, { $inc: { solde: amount } });
    rewardTransactions.push({
      beneficiaryType: 'PLAYER',
      beneficiaryId: player._id,
      enrollmentId: enrollment._id,
      amount,
      reason: `PARCOURS_TOP_${index + 1}`,
      createdAt: new Date(),
    });
    await notifyReward(player.userId.email, 'ELMES-QUIZ - Récompense parcours', amount, session.designation);
  }

  session.rewardsDistributed = true;
  session.paymentProcessedAt = new Date();
  session.rewardTransactions = [...(session.rewardTransactions || []), ...rewardTransactions];
  await session.save();

  return { success: true, distributed: rewardTransactions.length };
}

export async function distributeCompetitionSessionRewards(sessionId: string) {
  const session = await Session.findById(sessionId);
  if (!session) return { success: false, error: 'Session introuvable' };
  return {
    success: false,
    skipped: true,
    message: 'Distribution competition legacy desactivee : les gains sont credites progressivement en CDF via la Bourse.',
  };
  /*
  if (session.rewardsDistributed) {
    return { success: true, skipped: true, message: 'Récompenses déjà distribuées pour cette session.' };
  }

  const resource = (session.ressources || []).find((item: any) => item.type === 'Competition');
  if (!resource?.refId) return { success: true, distributed: 0, message: 'Aucune compétition liée.' };

  const competition: any = await Competition.findById(resource.refId).lean();
  const fund = Number(competition?.cagnotte || 0);
  if (fund <= 0) return { success: true, distributed: 0, message: 'Bourse indisponible.' };

  const enrollments: any[] = await Enrollement.find({
    sessionId: new mongoose.Types.ObjectId(sessionId),
    competitionId: resource.refId,
    equipeId: { $exists: true, $ne: null },
    status: 'CONFIRMED',
    points: { $gt: 0 },
  })
    .populate('equipeId', 'designation metriques')
    .sort({ points: -1, updatedAt: 1 });

  const totalEligibleScores = enrollments.reduce((sum, item) => sum + Number(item.points || 0), 0);
  if (totalEligibleScores <= 0) {
    return { success: true, distributed: 0, message: 'Aucun score éligible.' };
  }

  const rewardTransactions: any[] = [];
  let distributedTotal = 0;

  for (let index = 0; index < enrollments.length; index += 1) {
    const enrollment = enrollments[index];
    const rawAmount = (Number(enrollment.points || 0) / totalEligibleScores) * fund;
    const amount = index === enrollments.length - 1
      ? Math.max(0, roundAmount(fund - distributedTotal))
      : Math.min(roundAmount(rawAmount), roundAmount(fund - distributedTotal));

    if (amount <= 0 || !enrollment.equipeId?._id) continue;

    await Equipe.findByIdAndUpdate(enrollment.equipeId._id, { $inc: { 'metriques.soldeUsd': amount } });
    distributedTotal += amount;
    rewardTransactions.push({
      beneficiaryType: 'EQUIPE',
      beneficiaryId: enrollment.equipeId._id,
      enrollmentId: enrollment._id,
      amount,
      reason: 'COMPETITION_PROPORTIONAL_FUND',
      createdAt: new Date(),
    });
  }

  session.rewardsDistributed = true;
  session.paymentProcessedAt = new Date();
  session.rewardTransactions = [...(session.rewardTransactions || []), ...rewardTransactions];
  await session.save();

  return { success: true, distributed: rewardTransactions.length, distributedTotal };
  */
}
