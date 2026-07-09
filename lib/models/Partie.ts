import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReponsePartie {
  quizId: mongoose.Types.ObjectId;
  reponseDonnee?: string;
  estCorrecte: boolean;
}

export interface IPartie extends Document {
  playerId: mongoose.Types.ObjectId;
  enrollmentId?: mongoose.Types.ObjectId;
  categorieId: mongoose.Types.ObjectId;
  mode?: 'STANDALONE' | 'ADVANCED' | 'VIP' | 'AFFILIATION';
  gameSource?: 'standard' | 'affiliation' | 'parcours' | 'competition';
  levelPlayed: number;
  reponses: IReponsePartie[];
  note: number;
  status: 'EN_COURS' | 'TERMINE';
  questionExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PartieSchema: Schema<IPartie> = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollement' },
    categorieId: { type: Schema.Types.ObjectId, ref: 'Categorie', required: true },
    mode: { type: String, enum: ['STANDALONE', 'ADVANCED', 'VIP', 'AFFILIATION'], default: 'STANDALONE' },
    gameSource: { type: String, enum: ['standard', 'affiliation', 'parcours', 'competition'], default: 'standard' },
    levelPlayed: { type: Number, required: true },
    reponses: [
      {
        quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
        reponseDonnee: { type: String },
        estCorrecte: { type: Boolean, required: true }
      }
    ],
    note: { type: Number, required: true },
    status: { type: String, enum: ['EN_COURS', 'TERMINE'], default: 'EN_COURS' },
    questionExpiresAt: { type: Date, default: () => new Date(Date.now() + 15_000) }
  },
  { timestamps: true }
);

// Force le re-enregistrement pour prendre en compte les nouveaux champs (hot-reload Next.js)
delete mongoose.models.Partie;
const Partie: Model<IPartie> = mongoose.model<IPartie>('Partie', PartieSchema);
export default Partie;
