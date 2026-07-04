import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompetition extends Document {
  designation: string;
  description?: string;
  cagnotte: number;
  categories: mongoose.Types.ObjectId[];
  parties: number; // Nombre total de parties disponibles pour cette compétition
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
  image?: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompetitionSchema: Schema<ICompetition> = new Schema(
  {
    designation: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    cagnotte: { type: Number, required: true, default: 0 },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Categorie', required: true }],
    parties: { type: Number, required: true, default: 1 },
    status: { 
      type: String, 
      enum: ['ACTIVE', 'INACTIVE', 'COMPLETED'], 
      default: 'ACTIVE' 
    },
    image: { type: String, default: '' },
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const Competition: Model<ICompetition> = mongoose.models.Competition || mongoose.model<ICompetition>('Competition', CompetitionSchema);
export default Competition;