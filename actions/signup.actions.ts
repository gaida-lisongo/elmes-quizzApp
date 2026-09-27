'use server';

import { cookies } from 'next/headers';
import crypto from 'crypto';
import mongoose from 'mongoose';
import connectToDb from '../lib/utils/db';
import User from '../lib/models/User';
import Player from '../lib/models/Player';
import { hashPassword, validateNewPassword } from '../lib/utils/password';
import { generateReferralCode } from '../lib/utils/referral';
import { getJwtSecret, setSessionCookie } from '../lib/utils/auth';

export type PlayerType = 'STANDALONE' | 'ADVANCED' | 'VIP';

export type Statut = 'ELEVE' | 'ETUDIANT' | 'INDEPENDANT';

const VALID_PLAYER_TYPES: PlayerType[] = ['STANDALONE', 'ADVANCED', 'VIP'];
const VALID_STATUTS: Statut[] = ['ELEVE', 'ETUDIANT', 'INDEPENDANT'];

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
}

async function generateUniqueReferralCode(pseudo: string) {
  let code = generateReferralCode(pseudo);
  while (await Player.exists({ code })) {
    code = generateReferralCode(pseudo);
  }
  return code;
}

// Cookie d'inscription chiffré en AES-256-GCM : IV aléatoire et tag d'authentification (EX-SEC-05).
function signupKey() {
  return crypto.createHash('sha256').update(`signup-cookie:${getJwtSecret()}`).digest();
}

function encryptSignupPayload(payload: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', signupKey(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function decryptSignupPayload(value: string) {
  const [ivPart, tagPart, dataPart] = value.split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Cookie d’inscription invalide.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', signupKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
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
  const cleanHash = String(hash || '').replace(/^#/, '');
  const [typePart, queryString] = cleanHash.split('?');

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
 * Valide le code d'affiliation. Ne renvoie qu'un booléen (aucune donnée du parrain).
 */
export async function validateReferralCode(code: string) {
  try {
    await connectToDb();
    const exists = await Player.exists({ code: String(code || '').trim().toUpperCase() });
    if (!exists) return { success: false, error: 'Code d\'affiliation invalide.' };
    return { success: true };
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

  const pseudo = typeof data?.pseudo === 'string' ? data.pseudo : '';
  const telephone = typeof data?.telephone === 'string' ? data.telephone : '';
  const email = typeof data?.email === 'string' ? data.email : '';
  const school = typeof data?.school === 'string' ? data.school : '';
  const referralCode = typeof data?.referralCode === 'string' ? data.referralCode : undefined;

  if (!pseudo.trim() || !telephone.trim() || !email.trim() || !school.trim()) {
    return { success: false, error: 'Tous les champs sont obligatoires.' };
  }

  // Le type de joueur et le statut sont validés côté serveur (jamais pris tels quels du client).
  if (!VALID_PLAYER_TYPES.includes(data.playerType)) {
    return { success: false, error: 'Type de joueur invalide.' };
  }
  const statut: Statut = VALID_STATUTS.includes(data.statut) ? data.statut : 'ELEVE';

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
        referedBy = parrain._id as mongoose.Types.ObjectId;
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
      statut,
      school: school.trim(),
      playerType: data.playerType,
      referedBy: referedBy?.toString() || null,
      tempToken,
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 minutes
    });

    (await cookies()).set('signup_temp', encryptSignupPayload(tempPayload), {
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

  const password = data?.password;
  const passwordError = validateNewPassword(password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  try {
    // Récupérer le token temporaire
    const encryptedCookie = (await cookies()).get('signup_temp')?.value;
    if (!encryptedCookie) {
      return { success: false, error: 'Session expirée. Veuillez recommencer l\'inscription.' };
    }

    let tempData: any;
    try {
      tempData = JSON.parse(decryptSignupPayload(encryptedCookie));
    } catch {
      (await cookies()).set('signup_temp', '', { httpOnly: true, expires: new Date(0), path: '/' });
      return { success: false, error: 'Session expirée. Veuillez recommencer l\'inscription.' };
    }

    // Vérifier l'expiration
    if (Date.now() > tempData.expiresAt) {
      (await cookies()).set('signup_temp', '', { httpOnly: true, expires: new Date(0), path: '/' });
      return { success: false, error: 'Session expirée. Veuillez recommencer l\'inscription.' };
    }

    const { pseudo, telephone, email, statut, school, referedBy } = tempData;
    const playerType: PlayerType = VALID_PLAYER_TYPES.includes(tempData.playerType) ? tempData.playerType : 'STANDALONE';

    // Vérifier que l'utilisateur n'a pas été créé entre-temps
    const existingUser = await User.findOne({ $or: [{ telephone }, { email }] });
    if (existingUser) {
      return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
    }

    const hashedPassword = await hashPassword(password);

    // Création de l'utilisateur
    // TODO: permettre l'ajout ou la modification de la photo de profil depuis la page Profil après inscription.
    const newUser = await User.create({
      pseudo,
      telephone,
      email,
      solde: 0,
      role: 'PLAYER',
      secure: hashedPassword,
      photo: '',
    });

    // Générer un code de parrainage
    const referralCode = await generateUniqueReferralCode(pseudo);

    // Convertir referedBy en ObjectId si c'est une string (vient du cookie)
    const referedByObjectId = referedBy && referedBy !== 'null' && mongoose.Types.ObjectId.isValid(referedBy)
      ? new mongoose.Types.ObjectId(referedBy)
      : undefined;

    // Création du profil Player
    await Player.create({
      userId: newUser._id,
      referedBy: referedByObjectId,
      level: 0,
      type: playerType,
      statut: VALID_STATUTS.includes(statut) ? statut : 'ELEVE',
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
    await setSessionCookie(newUser._id.toString(), newUser.role, newUser.sessionVersion ?? 0);

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
