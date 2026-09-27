import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Trace d'application du bonus hebdomadaire (EX-JEU-03) : une seule application par semaine ISO.
 */
export interface IBonusRun extends Document {
  week: string; // Semaine ISO, ex. "2026-W39"
  appliedBy: mongoose.Types.ObjectId;
  standaloneCount: number;
  advancedEnrollmentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const BonusRunSchema: Schema<IBonusRun> = new Schema(
  {
    week: { type: String, required: true, unique: true },
    appliedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    standaloneCount: { type: Number, default: 0 },
    advancedEnrollmentsCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const BonusRun: Model<IBonusRun> = mongoose.models.BonusRun || mongoose.model<IBonusRun>('BonusRun', BonusRunSchema);
export default BonusRun;
