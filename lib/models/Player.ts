import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecharge {
  amount: number;
  providerTxId: string;
  reference?: string;
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
  targetLevel: number;
  productType?: 'TRAINING_PASS' | 'COMPETITION' | 'EQUIPE';
  resourceId?: string;
  metadata?: Record<string, any>;
  currency?: 'CDF' | 'USD';
  createdAt: Date;
}

export interface IRetrait {
  amount: number;
  providerTxId: string;
  reference?: string;
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
  method?: string;
  currency?: 'CDF' | 'USD';
  beneficiaryName?: string;
  message?: string;
  processedAt?: Date;
  validatedAt?: Date;
  createdAt: Date;
}

export interface IMetrics {
  totalScore: number;
  partiesJouees: number;
  partiesGagnees: number;
}

export interface IPlayer extends Document {
  userId: mongoose.Types.ObjectId;
  referedBy: mongoose.Types.ObjectId;
  code: string;
  type: 'STANDALONE' | 'ADVANCED' | 'VIP'
  level: 0 | 1 | 2 | 3;
  statut: 'ELEVE' | 'ETUDIANT' | 'INDEPENDANT';
  school: string;
  parties: number;
  usedAffiliateGames: number;
  recharges: IRecharge[];
  retraits: IRetrait[];
  metrics: IMetrics;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema: Schema<IPlayer> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    referedBy: { type: Schema.Types.ObjectId, ref: 'Player'},
    level: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    type: { type: String, enum: ['STANDALONE', 'ADVANCED', 'VIP'], default: 'STANDALONE' },
    statut: { type: String, enum: ['ELEVE', 'ETUDIANT', 'INDEPENDANT'], default: 'ELEVE' },
    school: { type: String, required: true },
    parties: { type: Number, default: 0},
    usedAffiliateGames: { type: Number, default: 0 },
    code: { type: String, default: ""},
    recharges: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, required: true },
        reference: { type: String },
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
        targetLevel: { type: Number, required: true },
        productType: { type: String, enum: ['TRAINING_PASS', 'COMPETITION', 'EQUIPE'] },
        resourceId: { type: String },
        metadata: { type: Schema.Types.Mixed, default: {} },
        currency: { type: String, enum: ['CDF', 'USD'], default: 'CDF' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    retraits: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, required: true },
        reference: { type: String },
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
        method: { type: String, default: 'MOBILE_MONEY' },
        currency: { type: String, enum: ['CDF', 'USD'], default: 'CDF' },
        beneficiaryName: { type: String },
        message: { type: String },
        processedAt: { type: Date },
        validatedAt: { type: Date },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    metrics: {
      totalScore: { type: Number, default: 0 },
      partiesJouees: { type: Number, default: 0 },
      partiesGagnees: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

const Player: Model<IPlayer> = mongoose.models.Player || mongoose.model<IPlayer>('Player', PlayerSchema);
export default Player;
