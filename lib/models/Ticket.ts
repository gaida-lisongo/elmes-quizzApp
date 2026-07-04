import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChat {
  userId: mongoose.Types.ObjectId;
  message: string;
  status: 'ENVOYE' | 'LU';
  createdAt: Date;
}

export interface ITicket extends Document {
  sujet: string;
  status: 'OUVERT' | 'EN_COURS' | 'RESOLU';
  description: string;
  playerId: mongoose.Types.ObjectId;
  chats: IChat[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['ENVOYE', 'LU'], default: 'ENVOYE' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TicketSchema: Schema<ITicket> = new Schema(
  {
    sujet: { type: String, required: true },
    status: {
      type: String,
      enum: ['OUVERT', 'EN_COURS', 'RESOLU'],
      default: 'OUVERT',
    },
    description: { type: String, required: true },
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    chats: [ChatSchema],
  },
  { timestamps: true }
);

const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema);

export default Ticket;