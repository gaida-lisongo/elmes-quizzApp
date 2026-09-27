import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReponsePartie {
  quizId: mongoose.Types.ObjectId;
  reponseDonnee?: string;
  estCorrecte: boolean;
}

export type PartieEndReason = 'COMPLETED' | 'WRONG_ANSWER' | 'TIMEOUT' | 'EXPIRED' | 'ABANDONED';

export interface IPartie extends Document {
  playerId: mongoose.Types.ObjectId;
  enrollmentId?: mongoose.Types.ObjectId;
  categorieId: mongoose.Types.ObjectId;
  categorieIds?: mongoose.Types.ObjectId[]; // Toutes les catégories du Parcours / de la Compétition (JEU-13)
  mode?: 'STANDALONE' | 'ADVANCED' | 'VIP' | 'AFFILIATION';
  gameSource?: 'standard' | 'affiliation' | 'parcours' | 'competition';
  levelPlayed: number;
  reponses: IReponsePartie[];
  note: number;
  status: 'EN_COURS' | 'TERMINE';
  questionExpiresAt: Date;
  scholarshipCredited?: boolean; // Anti-double crédit Bourse
  // ── Déroulement contrôlé par le serveur (EX-JEU-01) ──
  quizIds?: mongoose.Types.ObjectId[]; // Questions servies, dans l'ordre
  currentIndex?: number;               // Question en attente de réponse
  nbQuestions?: number;                // 3 (Standalone, Parcours, Affiliation) ou 5 (VIP)
  endReason?: PartieEndReason;         // Raison de la clôture
  endedAt?: Date;
  resultApplied?: boolean;             // Verrou : métriques et décompte appliqués une seule fois
  createdAt: Date;
  updatedAt: Date;
}

const PartieSchema: Schema<IPartie> = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: 'Player', required: true },
    enrollmentId: { type: Schema.Types.ObjectId, ref: 'Enrollement' },
    categorieId: { type: Schema.Types.ObjectId, ref: 'Categorie', required: true },
    categorieIds: [{ type: Schema.Types.ObjectId, ref: 'Categorie' }],
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
    questionExpiresAt: { type: Date, default: () => new Date(Date.now() + 15_000) },
    scholarshipCredited: { type: Boolean, default: false },
    quizIds: [{ type: Schema.Types.ObjectId, ref: 'Quiz' }],
    currentIndex: { type: Number, default: 0 },
    nbQuestions: { type: Number },
    endReason: { type: String, enum: ['COMPLETED', 'WRONG_ANSWER', 'TIMEOUT', 'EXPIRED', 'ABANDONED'] },
    endedAt: { type: Date },
    resultApplied: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Une seule partie en cours par joueur, garantie par la base.
// TODO(Q-04): exécuter scripts/migrations/2026-09-lots-1-3.mongodb.js AVANT le déploiement
// (clôture des parties EN_COURS existantes), sinon la création de l'index échoue.
PartieSchema.index(
  { playerId: 1 },
  { name: 'uniq_partie_en_cours_par_joueur', unique: true, partialFilterExpression: { status: 'EN_COURS' } },
);

// Force le re-enregistrement pour prendre en compte les nouveaux champs (hot-reload Next.js)
delete mongoose.models.Partie;
const Partie: Model<IPartie> = mongoose.model<IPartie>('Partie', PartieSchema);
export default Partie;
