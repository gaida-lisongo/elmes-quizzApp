'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDb from '../../lib/utils/db';
import User from '../../lib/models/User';
import Player from '../../lib/models/Player';
import Agent from '../../lib/models/Agent';
import { hashPassword } from './user.actions';
import { generateReferralCode } from '../../lib/utils/referral';

const JWT_SECRET = process.env.JWT_SECRET || 'genie_quiz_secret_key_ultra_secure_2026';
const COOKIE_NAME = 'genie_session';

// Fonctions utilitaires internes pour le jeton : userId:role:timestamp|signature
function generateToken(userId: string, role: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${role}:${timestamp}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return `${payload}|${signature}`;
}

// export async function hashPassword(password: string): Promise<string> {
//   return crypto.createHash('sha256').update(password).digest('hex');
// }

/**
 * 1. INSCRIPTION ÉLÈVE
 */
export async function registerPlayer(formData: FormData) {
  await connectToDb();

  const pseudo = formData.get('pseudo') as string;
  const telephone = formData.get('telephone') as string;
  const school = formData.get('school') as string;
  const password = formData.get('password') as string;
  const ref = formData.get('ref') as string | null;

  if (!pseudo || !telephone || !school || !password) {
    return { success: false, error: 'Tous les champs sont obligatoires.' };
  }

  try {
    // Vérifier si le téléphone existe déjà
    const existingUser = await User.findOne({ telephone: telephone.trim() });
    if (existingUser) {
      return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
    }

    const hashedPassword = await hashPassword(password);

    // Création de l'utilisateur de base (Rôle fixé à 'PLAYER' selon l'interface User)
    const newUser = await User.create({
      pseudo: pseudo.trim(),
      telephone: telephone.trim(),
      solde: 0,
      role: 'PLAYER',
      secure: hashedPassword,
    });

    // Résoudre le parrain (ref = pseudo du joueur parrain)
    let referedBy: mongoose.Types.ObjectId | undefined = undefined;
    if (ref) {
      const parrain = await Player.findOne({ code: ref.trim() });
      if (parrain) {
        referedBy = parrain._id;
      }
    }

    // Création du profil Player associé (10 parties de bienvenue offertes)
    // Générer un code de parrainage lisible pour le nouveau joueur
    const referralCode = generateReferralCode(pseudo);

    await Player.create({
      userId: newUser._id,
      referedBy,
      level: 0,
      school: school.trim(),
      parties: 10,
      code: referralCode,
      recharges: [],
      metrics: { totalScore: 0, partiesJouees: 0, MeilleurScore: 0 }
    });

    // Génération et injection du cookie de session (7 jours)
    const token = generateToken(newUser._id.toString(), newUser.role);
    
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 jours
      path: '/',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de l'inscription." };
  }
}

/**
 * 2. CONNEXION UTILISATEUR (Élève, Modérateur ou Admin)
 */
export async function loginUser(formData: FormData) {
  await connectToDb();

  const telephone = formData.get('telephone') as string;
  const password = formData.get('password') as string;

  console.log('loginUser called with:', { telephone, password });

  if (!telephone || !password) {
    console.log('Missing telephone or password');
    return { success: false, error: 'Téléphone et mot de passe requis.' };
  }

  try {
    // Récupérer l'utilisateur avec le champ 'secure' masqué par défaut
    const user = await User.findOne({ telephone: telephone.trim() }).select('+secure');
    console.log('User found:', user ? 'yes' : 'no');
    if (!user || !user.secure) {
      console.log('User not found or no secure field');
      return { success: false, error: 'Identifiants incorrects.' };
    }

    const hashedPassword = await hashPassword(password);
    console.log('Password comparison:', { stored: user.secure, provided: hashedPassword });
    if (user.secure !== hashedPassword) {
      console.log('Password mismatch');
      return { success: false, error: 'Identifiants incorrects.' };
    }

    // Génération et injection du cookie
    const token = generateToken(user._id.toString(), user.role);
    
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    console.log('Login successful, token set');
    return { success: true, role: user.role };
  } catch (error: any) {
    console.error('Login error:', error);
    return { success: false, error: error.message || 'Erreur lors de la connexion.' };
  }
}

/** 3. DÉCONNEXION */
export async function logoutUser() {
  (await cookies()).set(COOKIE_NAME, '', {
    httpOnly: true, expires: new Date(0), path: '/',
  });
  return { success: true };
}

/** 4. RÉCUPÉRER L'UTILISATEUR CONNECTÉ DÉTAILLÉ */
export async function getCurrentUserDetailed() {
  const { getSession } = await import('../../lib/utils/auth');
  const session = await getSession();
  if (!session) return null;

  await connectToDb();

  try {
    const user = await User.findById(session.userId).select('+secure').lean();
    if (!user) return null;

    const base = {
      _id: user._id.toString(),
      pseudo: user.pseudo,
      telephone: user.telephone,
      email: user.email || null,
      photo: user.photo || null,
      solde: user.solde,
      role: user.role,
    };

    // Si PLAYER → récupérer le profil Player
    if (user.role === 'PLAYER') {
      const player = await Player.findOne({ userId: user._id }).lean();
      if (!player) return { ...base, profile: null };
      return {
        ...base,
        profile: {
          type: 'PLAYER',
          level: player.level,
          parties: player.parties,
          school: player.school,
          metrics: player.metrics,
        },
      };
    }

    // Si MOD ou ADMIN → récupérer le profil Agent
    const agent = await Agent.findOne({ userId: user._id }).lean();
    if (!agent) return { ...base, profile: { type: user.role, permissions: [], retraits: [], tickets: [] } };

    return {
      ...base,
      profile: {
        type: user.role,
        permissions: agent.permissions,
        retraits: agent.retraits,
        tickets: agent.tickets,
      },
    };
  } catch {
    return null;
  }
}