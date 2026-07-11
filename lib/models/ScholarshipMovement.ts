import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IScholarshipMovement extends Document {
  sessionId: mongoose.Types.ObjectId;
  teamId?: mongoose.Types.ObjectId;
  enrollmentId?: mongoose.Types.ObjectId;
  gameId?: mongoose.Types.ObjectId;
  type: 'reward_per_won_game' | 'scholarship_admin_award' | 'scholarship_recompute' | 'enrollment_validated';
  amountCDF: number;
  beforeRemainingCDF: number;
  afterRemainingCDF: number;
  createdBy: 'SYSTEM' | 'ADMIN';
  note?: string;
  createdAt: Date;
}

const ScholarshipMovementSchema: Schema<IScholarshipMovement> = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Equipe' },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollement' },
    gameId: { type: Schema.Types.ObjectId, ref: 'Partie' },
    type: {
      type: String,
      enum: ['reward_per_won_game', 'scholarship_admin_award', 'scholarship_recompute', 'enrollment_validated'],
      required: true,
    },
    amountCDF: { type: Number, required: true },
    beforeRemainingCDF: { type: Number, required: true },
    afterRemainingCDF: { type: Number, required: true },
    createdBy: { type: String, enum: ['SYSTEM', 'ADMIN'], default: 'SYSTEM' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

const ScholarshipMovement: Model<IScholarshipMovement> =
  mongoose.models.ScholarshipMovement ||
  mongoose.model<IScholarshipMovement>('ScholarshipMovement', ScholarshipMovementSchema);

export default ScholarshipMovement;