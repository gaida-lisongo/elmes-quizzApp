import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQuiz extends Document {
  categorieId: mongoose.Types.ObjectId;
  enonce: string;
  assertions: string[]; // Tableau de propositions (ex: 4 choix)
  reponse: string;
  assets?: string;
  level: 0 | 1 | 2 | 3;
  status: boolean;
  type: 'QCM' | 'VRAI_FAUX';
  createdAt: Date;
  updatedAt: Date;
}

const QuizSchema: Schema<IQuiz> = new Schema(
  {
    categorieId: { type: Schema.Types.ObjectId, ref: 'Categorie', required: true },
    enonce: { type: String, required: true },
    assertions: [{ type: String, required: true }],
    reponse: { type: String, required: true },
    assets: { type: String, default: '' },
    level: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    status: { type: Boolean, default: true },
    type: { type: String, enum: ['QCM', 'VRAI_FAUX'], default: 'QCM' }
  },
  { timestamps: true }
);

const Quiz: Model<IQuiz> = mongoose.models.Quiz || mongoose.model<IQuiz>('Quiz', QuizSchema);
export default Quiz;