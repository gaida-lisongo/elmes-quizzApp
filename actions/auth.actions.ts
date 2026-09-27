'use server';

import { cookies } from 'next/headers';
import mongoose from 'mongoose';
import connectToDb from '../lib/utils/db';
import User from '../lib/models/User';
import Player from '../lib/models/Player';
import Agent from '../lib/models/Agent';
import { hashPassword, validateNewPassword, verifyPassword } from '../lib/utils/password';
import { generateReferralCode } from '../lib/utils/referral';
import { COOKIE_NAME, getSession, setSessionCookie } from '../lib/utils/auth';
import { consumeRateLimit, getClientIp, isRateLimited, resetRateLimit } from '../lib/utils/rateLimit';

// Limitation des tentatives de connexion (EX-SEC-05) : 5 échecs par tranche de 15 minutes,
// par téléphone et par adresse IP.
const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

async function generateUniqueReferralCode(pseudo: string) {
  let code = generateReferralCode(pseudo);
  while (await Player.exists({ code })) {
    code = generateReferralCode(pseudo);
  }
  return code;
}

/**
 * 1. INSCRIPTION ÉLÈVE
 */
export async function registerPlayer(formData: FormData) {
  await connectToDb();

  const pseudo = String(formData.get('pseudo') || '');
  const telephone = String(formData.get('telephone') || '');
  const school = String(formData.get('school') || '');
  const password = String(formData.get('password') || '');
  const ref = formData.get('ref') ? String(formData.get('ref')) : null;

  if (!pseudo || !telephone || !school || !password) {
    return { success: false, error: 'Tous les champs sont obligatoires.' };
  }
  const passwordError = validateNewPassword(password);
  if (passwordError) return { success: false, error: passwordError };

  try {
    // Vérifier si le téléphone existe déjà
    const existingUser = await User.findOne({ telephone: telephone.trim() });
    if (existingUser) {
      return { success: false, error: 'Ce numéro de téléphone est déjà utilisé.' };
    }

    // Résoudre le parrain (code d'affiliation)
    let referedBy: mongoose.Types.ObjectId | undefined = undefined;
    if (ref) {
      const parrain = await Player.findOne({ code: ref.trim().toUpperCase() });
      if (!parrain) {
        return { success: false, error: "Code d'affiliation invalide." };
      }
      referedBy = parrain._id as mongoose.Types.ObjectId;
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

    // Création du profil Player associé (10 parties de bienvenue offertes)
    const referralCode = await generateUniqueReferralCode(pseudo);

    await Player.create({
      userId: newUser._id,
      referedBy,
      type: 'STANDALONE',
      level: 0,
      school: school.trim(),
      parties: 10,
      code: referralCode,
      usedAffiliateGames: 0,
      recharges: [],
      metrics: { totalScore: 0, partiesJouees: 0, partiesGagnees: 0 }
    });

    // Génération et injection du cookie de session (7 jours)
    await setSessionCookie(newUser._id.toString(), newUser.role, newUser.sessionVersion ?? 0);

    // Cookie non-httpOnly pour le Header côté client
    (await cookies()).set('player_type', 'STANDALONE', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
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
  const telephone = String(formData.get('telephone') || '').trim();
  const password = String(formData.get('password') || '');

  if (!telephone || !password) {
    return { success: false, error: 'Téléphone et mot de passe requis.' };
  }

  const ip = await getClientIp();
  const phoneKey = `login:phone:${telephone}`;
  const ipKey = `login:ip:${ip}`;
  if ((await isRateLimited(phoneKey, LOGIN_MAX_FAILURES)) || (await isRateLimited(ipKey, LOGIN_MAX_FAILURES * 4))) {
    return { success: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' };
  }

  const registerFailure = async () => {
    await consumeRateLimit(phoneKey, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
    await consumeRateLimit(ipKey, LOGIN_MAX_FAILURES * 4, LOGIN_WINDOW_MS);
    return { success: false, error: 'Identifiants incorrects.' };
  };

  try {
    await connectToDb();

    // Récupérer l'utilisateur avec le champ 'secure' masqué par défaut
    const user = await User.findOne({ telephone }).select('+secure');
    if (!user || !user.secure) {
      return registerFailure();
    }

    const { valid, needsRehash } = await verifyPassword(password, user.secure);
    if (!valid) {
      return registerFailure();
    }

    // Migration transparente de l'ancienne empreinte SHA-256 vers scrypt
    if (needsRehash) {
      await User.updateOne({ _id: user._id }, { $set: { secure: await hashPassword(password) } });
    }
    await resetRateLimit(phoneKey);

    // Génération et injection du cookie
    await setSessionCookie(user._id.toString(), user.role, user.sessionVersion ?? 0);

    // Déterminer la redirection selon le rôle
    let redirectTo = '/dashboard';
    let playerTypeForCookie = '';

    if (user.role === 'PLAYER') {
      // Récupérer le type de joueur
      try {
        const player = await Player.findOne({ userId: user._id }).select('type').lean();
        const pType = player?.type || 'STANDALONE';
        playerTypeForCookie = pType;
        const routes: Record<string, string> = {
          STANDALONE: '/dashboard/standalone',
          ADVANCED: '/dashboard/advanced',
          VIP: '/dashboard/vip',
        };
        redirectTo = routes[pType] || '/dashboard/standalone';
      } catch {
        redirectTo = '/dashboard/standalone';
      }
    }

    // Stocker le type de joueur (ou le rôle staff) dans un cookie léger (accessible côté client)
    (await cookies()).set('player_type', playerTypeForCookie || user.role, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return { success: true, role: user.role, redirectTo };
  } catch (error: any) {
    console.error('[loginUser] Erreur de connexion :', error?.message);
    return { success: false, error: 'Erreur lors de la connexion.' };
  }
}

/** 3. DÉCONNEXION */
export async function logoutUser() {
  (await cookies()).set(COOKIE_NAME, '', {
    httpOnly: true, expires: new Date(0), path: '/',
  });
  (await cookies()).set('player_type', '', {
    httpOnly: false, expires: new Date(0), path: '/',
  });
  return { success: true };
}

/** 4. RÉCUPÉRER L'UTILISATEUR CONNECTÉ DÉTAILLÉ */
export async function getCurrentUserDetailed() {
  const session = await getSession();
  if (!session) return null;

  await connectToDb();

  try {
    const user = await User.findById(session.userId).lean();
    if (!user) return null;

    const base = {
      _id: user._id.toString(),
      pseudo: user.pseudo,
      telephone: user.telephone,
      email: user.email || null,
      photo: user.photo || null,
      solde: user.solde,
      soldeBloque: user.soldeBloque || 0,
      role: user.role,
      playerType: null as string | null,
    };

    // Si PLAYER → récupérer le profil Player
    if (user.role === 'PLAYER') {
      const player = await Player.findOne({ userId: user._id }).lean();
      if (!player) return { ...base, profile: null };
      base.playerType = player.type || 'STANDALONE';
      return {
        ...base,
        referralCode: player.code || null,
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
