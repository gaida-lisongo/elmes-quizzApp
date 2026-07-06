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
  payment: {
    orderNumber: string;
    status: string;
    providerText: string;
  }[];
  membres: {player: mongoose.Types.ObjectId, status: boolean, isSecretary: boolean}[];
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