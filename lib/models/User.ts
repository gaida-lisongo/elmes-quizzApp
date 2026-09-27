import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  pseudo: string;
  telephone: string;
  email?: string;
  photo?: string;
  solde: number;
  soldeBloque: number; // Montant réservé par les retraits en cours (solde disponible = solde - soldeBloque)
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  secure?: string;
  sessionVersion: number; // Incrémentée à chaque changement de rôle ou de mot de passe : révoque les jetons
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema<IUser> = new Schema(
  {
    pseudo: { type: String, required: true, trim: true },
    telephone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, sparse: true, trim: true },
    photo: { type: String, default: '' },
    solde: { type: Number, default: 0 },
    soldeBloque: { type: Number, default: 0 },
    role: {
      type: String,
      enum: ['PLAYER', 'MOD', 'ADMIN'],
      default: 'PLAYER'
    },
    secure: { type: String, select: false },
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
