'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDb from '../lib/utils/db';
import User from '../lib/models/User';
import Player from '../lib/models/Player';
import { hashPassword } from './user.actions';
import { generateReferralCode } from '../lib/utils/referral';

const JWT_SECRET = process.env.JWT_SECRET || 'genie_quiz_secret_key_ultra_secure_2026';
const COOKIE_NAME = 'genie_session';

export type PlayerType = 'STANDALONE' | 'ADVANCED' | 'VIP';

export type Statut = 'ELEVE' | 'ETUDIANT' | 'INDEPENDANT';

export interface SignupStep1Data {
  pseudo: string;
  telephone: string;
  email: string;
  statut: Statut;
  school: string;
  playerType: PlayerType;
  referralCode?: string;
}

export interface SignupStep2Data {
  password: string;
  photo?: string;
}

async function generateUniqueReferralCode(pseudo: string) {
  let code = generateReferralCode(pseudo);
  while (await Player.exists({ code })) {
    code = generateReferralCode(pseudo);
  }
  return code;
}

/**
 * Parse l'URL pour extraire le type de joueur et le code d'affiliation.
 * Exemples :
 *   /auth/signup#standalone
 *   /auth/signup#vip?code=AB-1234
 *   /auth/signup#advanced
 */
export async function parseSignupUrl(hash: string, searchParams: string) {
  // Le hash vient sous la forme "#standalone" ou "#vip?code=AB-1234"
  const cleanHash = hash.replace(/^#/, '');
  const [typePart, queryString] = cleanHash.split('?');

  // Valider le type de joueur
  const validTypes: PlayerType[] = ['STANDALONE', 'ADVANCED', 'VIP'];
  const typeMap: Record<string, PlayerType> = {
    standalone: 'STANDALONE',
    advanced: 'ADVANCED',
    vip: 'VIP',
  };

  const playerType = typeMap[typePart?.toLowerCase()] || 'STANDALONE';

  // Extraire le code d'affiliation depuis le hash ou depuis les searchParams
  let referralCode: string | undefined;

  if (queryString) {
    const params = new URLSearchParams(queryString);
    const code = params.get('code');
    if (code) referralCode = code;
  }

  // Fallback: vérifier aussi les searchParams de l'URL (/?code=...)
  if (!referralCode && searchParams) {
    const params = new URLSearchParams(searchParams);
    const code = params.get('code');
    if (code) referralCode = code;
  }

  return {
    playerType,
    referralCode: referralCode || null,
  };
}

/**
 * Valide le code d'affiliation et retourne le Player parrain si valide
 */
export async function validateReferralCode(code: string) {
  try {
    await connectToDb();
    const parrain = await Player.findOne({ code: code.trim().toUpperCase() });
    if (!parrain) return { success: false, error: 'Code d\'affiliation invalide.' };
    return { success: true, data: JSON.parse(JSON.stringify(parrain)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Étape 1 : Créer l'utilisateur (User + Player) avec les infos de base
 * Retourne un token temporaire pour l'étape 2
 */
export async function createPlayerStep1(data: SignupStep1Data) {
  await connectToDb();

  const { pseudo, telephone, email, statut, school, playerType, referralCode } = data;

  if (!pseudo?.trim() || !telephone?.trim() || !email?.trim() || !school?.trim()) {
    return { success: false, error: 'Tous les champs sont obligatoires.' };
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Vérifier si le téléphone ou l'email existe déjà
    const existingUser = await User.findOne({ $or: [{ telephone: telephone.trim() }, { email: normalizedEmail }] });
    if (existingUser) {
      return { success: false, error: existingUser.telephone === telephone.trim() ? 'Ce numéro de téléphone est déjà utilisé.' : 'Cette adresse email est déjà utilisée.' };
    }

    // Résoudre le parrain (code d'affiliation)
    let referedBy: mongoose.Types.ObjectId | undefined = undefined;
    if (referralCode) {
      const parrain = await Player.findOne({ code: referralCode.trim().toUpperCase() });
      if (parrain) {
        referedBy = parrain._id;
      } else {
        return { success: false, error: "Code d'affiliation invalide." };
      }
    }

    // Créer un token temporaire pour l'étape 2 (stocké en cookie, valide 30 min)
    const tempToken = crypto.randomBytes(32).toString('hex');
    const tempPayload = JSON.stringify({
      pseudo: pseudo.trim(),
      telephone: telephone.trim(),
      email: normalizedEmail,
      statut: statut || 'ELEVE',
      school: school.trim(),
      playerType,
      referedBy: referedBy?.toString() || null,
      tempToken,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    // Chiffrer le payload pour le cookie temporaire
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(JWT_SECRET).digest('hex').slice(0, 32),
      crypto.createHash('md5').update(JWT_SECRET).digest('hex').slice(0, 16)
    );
    let encrypted = cipher.update(tempPayload, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    (await cookies()).set('signup_temp', encrypted, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 minutes
      path: '/',
    });

    return {
      success: true,
      message: 'Informations validées. Veuillez définir votre mot de passe.',
      tempToken,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de l'inscription." };
  }
}

/**
 * Étape 2 : Finaliser l'inscription avec le mot de passe et la photo
 */
export async function createPlayerStep2(data: SignupStep2Data) {
  await connectToDb();

  const { password, photo } = data;

  if (!password || password.length < 4) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 4 caractères.' };
  }

  try {
    // Récupérer le token temporaire
    const encryptedCookie = (await cookies()).get('signup_temp')?.value;
    if (!encryptedCookie) {
      return { success: false, error: 'Session expirée. Veuillez recommencer l\'inscription.' };
    }

    // Déchiffrer le payload
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      crypto.createHash('sha256').update(JWT_SECRET).digest('hex').slice(0, 32),
      crypto.createHash('md5').update(JWT_SECRET).digest('hex').slice(0, 16)
    );
    let decrypted = decipher.update(encryptedCookie, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const tempData = JSON.parse(decrypted);

    // Vérifier l'expiration
    if (Date.now() > tempData.expiresAt) {
      (await cookies()).set('signup_temp', '', { httpOnly: true, expires: new Date(0), path: '/' });
      return { success: false, error: 'Session expirée. Veuillez recommencer l\'inscription.' };
    }

    const { pseudo, telephone, email, statut, school, playerType, referedBy } = tempData;

    // Vérifier que l'utilisateur n'a pas été créé entre-temps
    const existingUser = await User.findOne({ $or: [{ telephone }, { email }] });
    if (existingUser) {
      return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
    }

    const hashedPassword = await hashPassword(password);

    // Création de l'utilisateur
    const newUser = await User.create({
      pseudo,
      telephone,
      email,
      solde: 0,
      role: 'PLAYER',
      secure: hashedPassword,
      photo: photo || '',  // URL Cloudinary (uploadée depuis le frontend) ou chaîne vide
    });

    // Générer un code de parrainage
    const referralCode = await generateUniqueReferralCode(pseudo);

    // Convertir referedBy en ObjectId si c'est une string (vient du cookie)
    const referedByObjectId = referedBy && referedBy !== 'null'
      ? new mongoose.Types.ObjectId(referedBy)
      : undefined;

    // Création du profil Player
    await Player.create({
      userId: newUser._id,
      referedBy: referedByObjectId,
      level: 0,
      type: playerType,
      statut: statut || 'ELEVE',
      school,
      parties: 10, // 10 parties de bienvenue
      code: referralCode,
      usedAffiliateGames: 0,
      recharges: [],
      metrics: { totalScore: 0, partiesJouees: 0, partiesGagnees: 0 },
    });

    // Nettoyer le cookie temporaire
    (await cookies()).set('signup_temp', '', { httpOnly: true, expires: new Date(0), path: '/' });

    // Générer le token de session et connecter l'utilisateur
    const token = generateToken(newUser._id.toString(), newUser.role);
    (await cookies()).set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Cookie non-httpOnly pour que le Header lise le type côté client
    (await cookies()).set('player_type', playerType, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // Déterminer la redirection selon le type de joueur
    const dashboardRoutes: Record<string, string> = {
      STANDALONE: '/dashboard/standalone',
      ADVANCED: '/dashboard/advanced',
      VIP: '/dashboard/vip',
    };

    return {
      success: true,
      message: 'Compte créé avec succès ! Bienvenue sur ELMES-QUIZ.',
      redirectTo: dashboardRoutes[playerType] || '/dashboard/standalone',
      playerType,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la finalisation de l'inscription." };
  }
}

// Fonction utilitaire pour générer un token (copiée depuis auth.actions.ts)
function generateToken(userId: string, role: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${role}:${timestamp}`;
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return `${payload}|${signature}`;
}
