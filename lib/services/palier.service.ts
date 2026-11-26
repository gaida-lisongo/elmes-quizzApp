import 'server-only';
import mongoose, { type ClientSession } from 'mongoose';
import Player from '@/lib/models/Player';
import { tx } from '@/lib/utils/transaction';
import { palierDeRang, valeursSousLeRang, type RangPalier } from '@/lib/utils/paliers';

/**
 * Fait monter un joueur au moins au rang demandé (paliers cumulatifs).
 * Idempotent et sans retour en arrière : un joueur déjà à ce rang ou au-dessus n'est pas modifié.
 * Renvoie true si le palier a changé.
 */
export async function promouvoirJoueur(
  playerId: mongoose.Types.ObjectId | string | undefined | null,
  rang: RangPalier,
  dbSession: ClientSession | null = null,
): Promise<boolean> {
  if (!playerId || !mongoose.Types.ObjectId.isValid(String(playerId))) return false;
  const res = await Player.updateOne(
    { _id: playerId, $or: [{ type: { $in: valeursSousLeRang(rang) } }, { type: { $exists: false } }] },
    { $set: { type: palierDeRang(rang) } },
    tx(dbSession),
  );
  return res.modifiedCount > 0;
}
