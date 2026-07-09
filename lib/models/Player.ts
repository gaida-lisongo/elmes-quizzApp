import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecharge {
  amount: number;
  providerTxId: string;
  reference?: string;
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
  targetLevel: number;
  currency?: 'CDF' | 'USD';
  createdAt: Date;
}

export interface IRetrait {
  amount: number;
  providerTxId: string;
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
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
    code: { type: String, default: ""},
    recharges: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, required: true },
        reference: { type: String },
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
        targetLevel: { type: Number, required: true },
        currency: { type: String, enum: ['CDF', 'USD'], default: 'CDF' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    retraits: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, required: true },
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
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
