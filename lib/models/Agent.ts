import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRetrait {
  amount: number;
  providerTxId?: string; // ID de transaction Mobile Money pour le transfert
  status: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
  createdAt: Date;
}

export interface ITicketRef {
  ticketId: string; // Référence ou ID du ticket de support géré
  assignedAt: Date;
}

export interface IAgent extends Document {
  userId: mongoose.Types.ObjectId;
  permissions: string[]; // Ex: ['ADMIN', 'MODERATEUR']
  retraits: IRetrait[];  // Historique des retraits de commissions/fonds
  tickets: ITicketRef[]; // Liste des tickets de support assignés ou gérés
  createdAt: Date;
  updatedAt: Date;
}

const AgentSchema: Schema<IAgent> = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    permissions: [{ type: String, required: true }],
    retraits: [
      {
        amount: { type: Number, required: true },
        providerTxId: { type: String, trim: true },
        status: { type: String, enum: ['EN_ATTENTE', 'SUCCES', 'ECHEC'], default: 'EN_ATTENTE' },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    tickets: [
      {
        ticketId: { type: String, required: true },
        assignedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
export default Agent;