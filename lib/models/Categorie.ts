import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategorie extends Document {
  designation: string;
  description?: string;
  image?: string;
  slug: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorieSchema: Schema<ICategorie> = new Schema(
  {
    designation: { type: String, required: true, unique: true },
    description: { type: String },
    image: { type: String, default: '' },
    slug: { type: String, required: true, unique: true },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Categorie: Model<ICategorie> = mongoose.models.Categorie || mongoose.model<ICategorie>('Categorie', CategorieSchema);
export default Categorie;