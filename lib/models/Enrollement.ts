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
  createdAt: Date;
  updatedAt: Date;
}

export interface IEnrollement extends Document {
  equipeId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
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
  },
  { timestamps: true }
);

const EnrollementSchema: Schema<IEnrollement> = new Schema(
  {
    equipeId: { type: Schema.Types.ObjectId, ref: 'Equipe', required: true },
    competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
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