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
  type: 'parcours' | 'competition';
  startDate: Date;
  endDate: Date;
  ressources: {
    type: 'Parcours' | 'Competition';
    refId: mongoose.Types.ObjectId;
  }[];
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'PAYMENT'
  rewardsDistributed: boolean;
  paymentProcessedAt?: Date;
  rewardTransactions: {
    beneficiaryType: 'PLAYER' | 'EQUIPE';
    beneficiaryId: mongoose.Types.ObjectId;
    enrollmentId: mongoose.Types.ObjectId;
    amount: number;
    reason: string;
    createdAt: Date;
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
  maxParties: number;
  totalGrantedGames: number;
  usedGames: number;
  remainingGames: number;
  points: number;
  parties: number; // Parties jouées par l'équipe dans cette compétition
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema: Schema<ISession> = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    designation: { type: String, required: true, trim: true },
    type: { type: String, enum: ['parcours', 'competition'], required: true, default: 'parcours' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'COMPLETED', 'PAYMENT'], default: 'ACTIVE' },
    rewardsDistributed: { type: Boolean, default: false },
    paymentProcessedAt: { type: Date },
    rewardTransactions: [
      {
        beneficiaryType: { type: String, enum: ['PLAYER', 'EQUIPE'], required: true },
        beneficiaryId: { type: Schema.Types.ObjectId, required: true },
        enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollement', required: true },
        amount: { type: Number, required: true },
        reason: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      }
    ],
    ressources: [{
      type: { type: String, enum: ['Parcours', 'Competition'], required: true },
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
    maxParties: { type: Number, default: 0 },
    totalGrantedGames: { type: Number, default: 0 },
    usedGames: { type: Number, default: 0 },
    remainingGames: { type: Number, default: 0 },
    points: { type: Number, default: 0},
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

EnrollementSchema.index(
  { playerId: 1, parcoursId: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      playerId: { $exists: true },
      parcoursId: { $exists: true },
      sessionId: { $exists: true },
    },
  },
);

EnrollementSchema.index(
  { equipeId: 1, competitionId: 1, sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      equipeId: { $exists: true },
      competitionId: { $exists: true },
      sessionId: { $exists: true },
    },
  },
);

const Enrollement: Model<IEnrollement> = mongoose.models.Enrollement || mongoose.model<IEnrollement>('Enrollement', EnrollementSchema);
const Session: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
export default { Enrollement, Session };
