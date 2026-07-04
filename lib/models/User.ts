import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  pseudo: string;
  telephone: string;
  email?: string;
  photo?: string;
  solde: number;
  role: 'PLAYER' | 'MOD' | 'ADMIN';
  secure?: string;
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
    role: { 
      type: String, 
      enum: ['PLAYER', 'MOD', 'ADMIN'], 
      default: 'PLAYER' 
    },
    secure: { type: String, select: false },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;