import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEquipeMetrics {
  competitions: number;
  soldeUsd: number;
  matchsWin: number;
}

export interface IEquipe extends Document {
  chefId: mongoose.Types.ObjectId;
  designation: string;
  description: string[];
  logo: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  archivedAt?: Date;
  payment: {
    orderNumber: string;
    status: string;
    providerText: string;
  }[];
  membres: {player: mongoose.Types.ObjectId, status: boolean, isSecretary: boolean}[];
  purchaseOrders: {
    createdBy: mongoose.Types.ObjectId;
    beneficiaryUserId: mongoose.Types.ObjectId;
    beneficiaryPlayerId: mongoose.Types.ObjectId;
    amount: number;
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: mongoose.Types.ObjectId;
    approvedAt?: Date;
    creditedAt?: Date;
    createdAt: Date;
  }[];
  metriques: IEquipeMetrics;
  createdAt: Date;
  updatedAt: Date;
}

const EquipeSchema: Schema<IEquipe> = new Schema(
  {
    chefId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    designation: { type: String, required: true, trim: true },
    description: [{ type: String, required: true, trim: true }],
    logo: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
    archivedAt: { type: Date },
    payment: [
      {
        orderNumber: { type: String, required: true },
        status: { type: String, required: true },
        providerText: { type: String, required: true },
      },
    ],
    membres: [
      {
        player: { type: Schema.Types.ObjectId, ref: 'Player' },
        status: { type: Boolean, default: false },
        isSecretary: { type: Boolean, default: false },
      },
    ],
    purchaseOrders: [
      {
        createdBy: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
        beneficiaryUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        beneficiaryPlayerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
        amount: { type: Number, required: true },
        reason: { type: String, required: true, trim: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'Player' },
        approvedAt: { type: Date },
        creditedAt: { type: Date },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    metriques: {
      competitions: { type: Number, default: 0 },
      soldeUsd: { type: Number, default: 0 },
      matchsWin: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const Equipe: Model<IEquipe> =
  mongoose.models.Equipe || mongoose.model<IEquipe>('Equipe', EquipeSchema);
export default Equipe;
