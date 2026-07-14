import mongoose from 'mongoose';
import connectToDb from '@/lib/utils/db';
import EnrollementModule from '@/lib/models/Enrollement';

const { Enrollement } = EnrollementModule;

export const SESSION_GAMES_PER_VALIDATED_ENROLLMENT = 250;

export async function grantSessionGamesAfterEnrollmentValidation(enrollmentId: string) {
  await connectToDb();

  if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
    return { success: false, error: 'Enrollement invalide.' };
  }

  const enrollment = await Enrollement.findById(enrollmentId);
  if (!enrollment) return { success: false, error: 'Enrollement introuvable.' };
  if (enrollment.status !== 'CONFIRMED') {
    return { success: false, error: 'Les parties ne peuvent etre accordees qu apres validation.' };
  }
  if (enrollment.gamesGranted || enrollment.gamesGrantedAt) {
    return { success: true, skipped: true, message: 'Parties deja accordees.' };
  }

  const usedGames = Math.max(0, Number(enrollment.usedGames || enrollment.parties || 0));
  const grantedGames = SESSION_GAMES_PER_VALIDATED_ENROLLMENT;

  const updated = await Enrollement.findOneAndUpdate(
    {
      _id: enrollment._id,
      status: 'CONFIRMED',
      gamesGranted: { $ne: true },
      gamesGrantedAt: { $exists: false },
    },
    {
      $set: {
        totalGrantedGames: grantedGames,
        maxParties: grantedGames,
        usedGames,
        remainingGames: Math.max(0, grantedGames - usedGames),
        gamesGranted: true,
        gamesGrantedAt: new Date(),
        validatedAt: enrollment.validatedAt || new Date(),
        paymentStatus: 'PAID',
      },
    },
    { new: true },
  ).lean();

  if (!updated) {
    return { success: true, skipped: true, message: 'Parties deja accordees.' };
  }

  return {
    success: true,
    grantedGames,
    remainingGames: updated.remainingGames || 0,
  };
}
