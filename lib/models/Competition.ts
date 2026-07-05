import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IParcours extends Document {
  designation: string;
  description?: string;
  categories: mongoose.Types.ObjectId[];
  questions: number; // Nombre total de parties disponibles pour cette compétition
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
  image?: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompetition extends IParcours {
  cagnotte: number;
  amount: number; // Montant de la cagnotte pour la compétition
}

const ParcoursSchema: Schema<IParcours> = new Schema(
  {
    designation: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Categorie', required: true }],
    questions: { type: Number, required: true, default: 1 },
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

const CompetitionSchema: Schema<ICompetition> = new Schema(
  {
    designation: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    cagnotte: { type: Number, required: true, default: 0 },
    amount: { type: Number, required: true, default: 0 },
    categories: [{ type: Schema.Types.ObjectId, ref: 'Categorie', required: true }],
    questions: { type: Number, required: true, default: 1 },
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
const Parcours: Model<IParcours> = mongoose.models.Parcours || mongoose.model<IParcours>('Parcours', ParcoursSchema);

export { Competition, Parcours };