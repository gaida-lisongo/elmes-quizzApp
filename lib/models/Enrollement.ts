import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITransaction {
  membre: mongoose.Types.ObjectId; // Référence à Player
  montant: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  orderNumber: string;
  phone: string;
  createdAt: Date;
}

export interface ISession extends Document {
  slug: string;
  designation: string;
  startDate: Date;
  endDate: Date;
  ressources: {
    type: 'parcours' | 'competition';
    refId: mongoose.Types.ObjectId;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IEnrollement extends Document {
  equipeId?: mongoose.Types.ObjectId;
  playerId?: mongoose.Types.ObjectId;
  competitionId?: mongoose.Types.ObjectId;
  parcoursId?: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  code: string; // Code unique pour l'enrôlement;
  orderNumber: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  parties: number; // Parties jouées par l'équipe dans cette compétition
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema<ISession> = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    designation: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    ressources: [{
      type: { type: String, enum: ['parcours', 'competition'], required: true },
      refId: { type: Schema.Types.ObjectId, required: true, refPath: 'ressources.type' },
    }],
  },
  { timestamps: true }
);

const EnrollementSchema: Schema<IEnrollement> = new Schema(
  {
    equipeId: { type: Schema.Types.ObjectId, ref: 'Equipe' },
    playerId: { type: Schema.Types.ObjectId, ref: 'Player' },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition' },
    parcoursId: { type: Schema.Types.ObjectId, ref: 'Parcours' },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session' },
    code: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true, unique: true },
    status: { 
      type: String, 
      enum: ['PENDING', 'CONFIRMED', 'CANCELLED'], 
      default: 'PENDING' 
    },
    parties: { type: Number, default: 0 },
    transactions: [
      {
        membre: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
        montant: { type: Number, required: true },
        status: { 
          type: String, 
          enum: ['PENDING', 'PAID', 'FAILED'], 
          default: 'PENDING' 
        },
        orderNumber: { type: String, required: true },
        phone: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Enrollement: Model<IEnrollement> = mongoose.models.Enrollement || mongoose.model<IEnrollement>('Enrollement', EnrollementSchema);
const Session: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
export default { Enrollement, Session };