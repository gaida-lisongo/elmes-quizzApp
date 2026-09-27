import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRecharge {
  _id?: mongoose.Types.ObjectId;
  amount: number; // Montant réellement demandé au payeur, dans la devise `currency`
  providerTxId: string;
  reference?: string;
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC' | 'A_VERIFIER';
  targetLevel: number;
  creditedParties?: number;
  creditedAt?: Date;
  productType?: 'TRAINING_PASS' | 'PARCOURS' | 'COMPETITION' | 'EQUIPE';
  resourceId?: string;
  metadata?: Record<string, any>;
  currency?: 'CDF' | 'USD';
  // Registre de transaction (EX-PAY-02, EX-PAY-05)
  productId?: string;              // Identifiant catalogue (ex. "elonga") ou ressource
  amountCDF?: number;              // Équivalent CDF du montant payé
  fxRate?: number;                 // Taux utilisé pour amountCDF (1 si payé en CDF)
  beneficiaryPlayerId?: mongoose.Types.ObjectId; // Achat pour un tiers (Q-07)
  appliedAt?: Date;                // Verrou : effet du paiement appliqué une seule fois
  providerAmount?: number;         // Montant renvoyé par le fournisseur à la vérification
  failureReason?: string;
  createdAt: Date;
}

export interface IRetrait {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  providerTxId: string;
  reference?: string;
  status: 'EN_ATTENTE' | 'EN_COURS' | 'SUCCES' | 'ECHEC';
  method?: string;
  currency?: 'CDF' | 'USD';
  phone?: string;                  // Numéro Mobile Money saisi par le joueur (PAY-26)
  validatedBy?: mongoose.Types.ObjectId;
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
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC', 'A_VERIFIER'], default: 'EN_ATTENTE' },
        targetLevel: { type: Number, required: true },
        creditedParties: { type: Number, default: 0 },
        creditedAt: { type: Date },
        productType: { type: String, enum: ['TRAINING_PASS', 'PARCOURS', 'COMPETITION', 'EQUIPE'] },
        resourceId: { type: String },
        metadata: { type: Schema.Types.Mixed, default: {} },
        currency: { type: String, enum: ['CDF', 'USD'], default: 'CDF' },
        productId: { type: String },
        amountCDF: { type: Number },
        fxRate: { type: Number },
        beneficiaryPlayerId: { type: Schema.Types.ObjectId, ref: 'Player' },
        appliedAt: { type: Date },
        providerAmount: { type: Number },
        failureReason: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    retraits: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, required: true },
        reference: { type: String },
        status: { type: String, enum: ['EN_ATTENTE', 'EN_COURS', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
        method: { type: String, default: 'MOBILE_MONEY' },
        currency: { type: String, enum: ['CDF', 'USD'], default: 'CDF' },
        phone: { type: String },
        validatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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
