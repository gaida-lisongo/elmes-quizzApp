import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IParcours extends Document {
  designation: string;
  description?: string;
  ressources?: string
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

export interface ICritere extends Document {
  sessionId?: mongoose.Types.ObjectId;
  designation: string;
  slug: string;
  description: string;
  firstRecompense: number;
  secondRecompense: number;
  thirdRecompense: number;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ParcoursSchema: Schema<IParcours> = new Schema(
  {
    designation: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    ressources: { type: String, default: '' },
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
    ressources: { type: String, default: ''},
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

const CritereSchema: Schema<ICritere> = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    designation: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    firstRecompense: { type: Number, default: 0 },
    secondRecompense: { type: Number, default: 0 },
    thirdRecompense: { type: Number, default: 0 },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Competition: Model<ICompetition> = mongoose.models.Competition || mongoose.model<ICompetition>('Competition', CompetitionSchema);
const Parcours: Model<IParcours> = mongoose.models.Parcours || mongoose.model<IParcours>('Parcours', ParcoursSchema);
const Critere: Model<ICritere> = mongoose.models.Critere || mongoose.model<ICritere>('Critere', CritereSchema);

export { Competition, Parcours, Critere };
