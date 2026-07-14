import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITransaction {
  membre: mongoose.Types.ObjectId; // Référence à Player
  montant: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
  orderNumber: string;
  phone: string;
  currency?: 'CDF' | 'USD';
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
  // ── Bourse d'Excellence Académique (CDF uniquement) ──
  enrollmentFeeCDF?: number;               // Frais d'enrôlement en CDF pour cette session
  platformRate?: number;                   // Taux part plateforme (ex: 0.35)
  scholarshipRate?: number;                // Taux Bourse (ex: 0.65)
  gamesPerEnrollment?: number;             // Parties accordées par enrôlement (ex: 250)
  totalValidatedEnrollments?: number;      // Nombre d'enrôlements validés
  totalCollectedCDF?: number;              // Total encaissé CDF
  platformAmountCDF?: number;              // Part plateforme CDF
  scholarshipInitialAmountCDF?: number;    // Bourse initiale CDF
  scholarshipDistributedAmountCDF?: number;// Bourse déjà distribuée CDF
  scholarshipRemainingAmountCDF?: number;  // Bourse restante CDF
  totalGrantedGames?: number;              // Total parties accordées
  unitRewardPerWonGameCDF?: number;        // Valeur unitaire d'une partie gagnée CDF
  lastScholarshipComputedAt?: Date;        // Dernier recalcul
  scholarshipFullyDistributedAt?: Date;     // Date d'épuisement total
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
  paymentStatus?: 'PENDING' | 'PAID' | 'FAILED';
  amountCDF?: number;
  amountUSD?: number;
  paidAmount?: number;
  paidCurrency?: 'CDF' | 'USD';
  maxParties: number;
  totalGrantedGames: number;
  usedGames: number;
  remainingGames: number;
  gamesGranted: boolean;
  gamesGrantedAt?: Date;
  validatedAt?: Date;
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
    // ── Bourse d'Excellence Académique (CDF) ──
    enrollmentFeeCDF: { type: Number, default: null },
    platformRate: { type: Number, default: 0.35 },
    scholarshipRate: { type: Number, default: 0.65 },
    gamesPerEnrollment: { type: Number, default: 250 },
    totalValidatedEnrollments: { type: Number, default: 0 },
    totalCollectedCDF: { type: Number, default: 0 },
    platformAmountCDF: { type: Number, default: 0 },
    scholarshipInitialAmountCDF: { type: Number, default: 0 },
    scholarshipDistributedAmountCDF: { type: Number, default: 0 },
    scholarshipRemainingAmountCDF: { type: Number, default: 0 },
    totalGrantedGames: { type: Number, default: 0 },
    unitRewardPerWonGameCDF: { type: Number, default: 0 },
    lastScholarshipComputedAt: { type: Date },
    scholarshipFullyDistributedAt: { type: Date },
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
    paymentStatus: { type: String, enum: ['PENDING', 'PAID', 'FAILED'], default: 'PENDING' },
    amountCDF: { type: Number, default: 0 },
    amountUSD: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paidCurrency: { type: String, enum: ['CDF', 'USD'] },
    maxParties: { type: Number, default: 0 },
    totalGrantedGames: { type: Number, default: 0 },
    usedGames: { type: Number, default: 0 },
    remainingGames: { type: Number, default: 0 },
    gamesGranted: { type: Boolean, default: false },
    gamesGrantedAt: { type: Date },
    validatedAt: { type: Date },
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
        currency: { type: String, enum: ['CDF', 'USD'] },
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
