'use server';

import mongoose from "mongoose";
import Agent from "../lib/models/Agent";
import User from "../lib/models/User";
import connectToDb from "../lib/utils/db";
import { hashPassword, validateNewPassword } from "../lib/utils/password";
import { AGENT_PERMISSIONS, guardAdmin, guardStaff } from "../lib/utils/guards";

// Toutes les actions de ce fichier sont réservées à l'ADMIN (EX-SEC-02), sauf addAgentRetrait
// qui concerne l'agent connecté lui-même. hashPassword n'est plus exporté d'un fichier 'use server'
// (voir lib/utils/password.ts).

interface CreateAgentParams {
  pseudo: string;
  telephone: string;
  email?: string;
  role: 'PLAYER' | 'MOD' | 'ADMIN'; // Restreint aux rôles administratifs
  secure: string; // Mot de passe en clair à chiffrer
}

const VALID_ROLES = ['PLAYER', 'MOD', 'ADMIN'] as const;

const isValidId = (value: unknown): value is string =>
  typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const sanitizePermissions = (permissions: unknown) =>
  Array.isArray(permissions)
    ? Array.from(new Set(permissions.filter((p): p is string => typeof p === 'string' && (AGENT_PERMISSIONS as readonly string[]).includes(p))))
    : [];

export async function getAgents() {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb(); // Réutilisation du connecteur Atlas mis en cache

    const agents = await Agent.find().populate({
      path: 'userId',
      select: 'pseudo telephone email photo role createdAt',
    });

    return { success: true, data: JSON.parse(JSON.stringify(agents)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée un utilisateur de type staff/agent, hache son mot de passe,
 * puis initialise son document Agent sans permissions (à attribuer manuellement).
 */
export async function createAgent(params: CreateAgentParams) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    const pseudo = String(params?.pseudo || '');
    const telephone = String(params?.telephone || '');
    const email = typeof params?.email === 'string' ? params.email : undefined;
    const secure = String(params?.secure || '');
    const role = params?.role;

    // 1. Validations de base
    if (!pseudo.trim() || !telephone.trim() || !secure.trim()) {
      return { success: false, error: "Le pseudo, le téléphone et le mot de passe sont obligatoires." };
    }
    if (role !== 'MOD' && role !== 'ADMIN') {
      return { success: false, error: "Le rôle d'un agent doit être MOD ou ADMIN." };
    }
    const passwordError = validateNewPassword(secure);
    if (passwordError) return { success: false, error: passwordError };

    // 2. Vérifier si un utilisateur possède déjà ce numéro de téléphone
    const existingUser = await User.findOne({ telephone: telephone.trim() });
    if (existingUser) {
      return { success: false, error: "Un utilisateur existe déjà avec ce numéro de téléphone." };
    }

    // 3. Hachage du mot de passe (scrypt)
    const hashedPassword = await hashPassword(secure);

    // 4. Création de l'utilisateur de base
    const newUser = await User.create({
      pseudo: pseudo.trim(),
      telephone: telephone.trim(),
      email: email?.trim() || undefined,
      role: role,
      secure: hashedPassword,
      solde: 0
    });

    // 5. Création du profil Agent sans permissions (attribuées manuellement ensuite)
    const newAgent = await Agent.create({
      userId: newUser._id,
      permissions: [], // Zéro permission à la création
      retraits: [],
      tickets: []
    });

    // 6. Récupérer le document complet peuplé pour le renvoyer proprement à l'interface
    const populatedAgent = await Agent.findById(newAgent._id).populate({
      path: 'userId',
      select: 'pseudo telephone email photo role createdAt',
    });

    return {
      success: true,
      message: `L'utilisateur ${pseudo} a été créé avec le rôle ${role} et son profil Agent a été initialisé.`,
      data: JSON.parse(JSON.stringify(populatedAgent))
    };

  } catch (error: any) {
    console.error("❌ Erreur lors de la création de l'agent:", error?.message);
    return { success: false, error: error.message || "Une erreur est survenue lors de la création." };
  }
}

export async function updateUser(
  userId: string,
  data: { pseudo?: string; role: 'PLAYER' | 'MOD' | 'ADMIN'; telephone?: string; email?: string; secure?: string }
) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    if (!isValidId(userId)) return { success: false, error: "L'ID de l'utilisateur est requis." };

    const current = await User.findById(userId).select('role').lean();
    if (!current) return { success: false, error: "Utilisateur introuvable." };

    const updateData: any = {};
    let revokeSessions = false;
    if (typeof data?.pseudo === 'string' && data.pseudo.trim()) updateData.pseudo = data.pseudo.trim();
    if (typeof data?.email === 'string' && data.email.trim()) updateData.email = data.email.trim();
    if (typeof data?.role === 'string' && data.role.trim()) {
      const role = data.role.trim();
      if (!(VALID_ROLES as readonly string[]).includes(role)) return { success: false, error: "Rôle invalide." };
      if (userId === guard.session.userId && role !== 'ADMIN') {
        return { success: false, error: "Vous ne pouvez pas retirer votre propre rôle ADMIN." };
      }
      if (role !== current.role) {
        updateData.role = role;
        revokeSessions = true;
      }
    }

    if (typeof data?.telephone === 'string' && data.telephone.trim()) {
      // Vérifier l'unicité du numéro s'il change
      const existing = await User.findOne({ telephone: data.telephone.trim(), _id: { $ne: userId } });
      if (existing) return { success: false, error: "Ce numéro de téléphone est déjà utilisé." };
      updateData.telephone = data.telephone.trim();
    }

    if (typeof data?.secure === 'string' && data.secure.trim()) {
      const passwordError = validateNewPassword(data.secure);
      if (passwordError) return { success: false, error: passwordError };
      updateData.secure = await hashPassword(data.secure);
      revokeSessions = true;
    }

    // Un changement de rôle ou de mot de passe révoque les sessions en cours (sessionVersion).
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData, ...(revokeSessions ? { $inc: { sessionVersion: 1 } } : {}) },
      { new: true },
    ).select('pseudo telephone email photo role');

    if (!updatedUser) return { success: false, error: "Utilisateur introuvable." };

    return {
      success: true,
      message: "Utilisateur mis à jour avec succès.",
      data: JSON.parse(JSON.stringify(updatedUser))
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la modification de l'utilisateur." };
  }
}

/**
 * 2. SUPPRESSION D'UN UTILISATEUR SIMPLE (Élève par exemple)
 */
export async function deleteUser(userId: string) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    if (!isValidId(userId)) return { success: false, error: "L'ID de l'utilisateur est requis." };

    const user = await User.findById(userId);
    if (!user) return { success: false, error: "Utilisateur introuvable." };

    // Sécurité : Éviter de supprimer Gaïda ou Obed via une action générique
    if (user.role === 'PLAYER' || user.role === 'MOD' || user.role === 'ADMIN') {
      return { success: false, error: "Impossible de supprimer un administrateur principal du système." };
    }

    await User.findByIdAndDelete(userId);

    return { success: true, message: "L'utilisateur a été supprimé définitivement." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la suppression de l'utilisateur." };
  }
}

/**
 * 3. SUPPRESSION D'UN AGENT (Supprime le profil Agent EN PREMIER, puis son User associé)
 */
export async function deleteAgentAndUser(agentId: string) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    if (!isValidId(agentId)) return { success: false, error: "L'ID de l'agent est requis." };

    // 1. Trouver l'agent pour récupérer son userId lié
    const agent = await Agent.findById(agentId);
    if (!agent) return { success: false, error: "Profil Agent introuvable." };

    const userId = agent.userId;
    if (userId?.toString() === guard.session.userId) {
      return { success: false, error: "Vous ne pouvez pas supprimer votre propre compte." };
    }

    // 2. Supprimer le profil Agent en premier
    await Agent.findByIdAndDelete(agentId);

    // 3. Supprimer le document User associé
    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        await User.findByIdAndDelete(userId);
      }
    }

    return { success: true, message: "L'agent et son compte utilisateur ont été supprimés avec succès." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la suppression complète de l'agent." };
  }
}

/**
 * 4. MODIFICATION D'UN AGENT (Permissions uniquement)
 */
export async function updateAgentPermissions(agentId: string, permissions: string[]) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    if (!isValidId(agentId)) return { success: false, error: "L'ID de l'agent est requis." };

    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      { $set: { permissions: sanitizePermissions(permissions) } },
      { new: true }
    ).populate({
      path: 'userId',
      select: 'pseudo telephone role'
    });

    if (!updatedAgent) return { success: false, error: "Profil Agent introuvable." };

    return {
      success: true,
      message: "Permissions de l'agent mises à jour avec succès.",
      data: JSON.parse(JSON.stringify(updatedAgent))
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors de la mise à jour des permissions." };
  }
}

export async function updateAgentRetraitStatus(
  agentId: string,
  retraitId: string,
  status: 'SUCCES' | 'ECHEC',
  providerTxId?: string
) {
  try {
    const guard = await guardAdmin();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    if (!isValidId(agentId) || !isValidId(retraitId)) {
      return { success: false, error: "L'ID de l'agent et l'ID du retrait sont requis." };
    }
    if (status !== 'SUCCES' && status !== 'ECHEC') {
      return { success: false, error: "Statut invalide." };
    }

    // Préparation des champs à mettre à jour dynamiquement dans le sous-document
    const updateFields: any = {
      'retraits.$.status': status
    };

    // Si un ID de transaction Mobile Money (M-Pesa, Orange, Airtel) est fourni, on l'enregistre
    if (typeof providerTxId === 'string' && providerTxId.trim()) {
      updateFields['retraits.$.providerTxId'] = providerTxId.trim();
    }

    // Recherche l'agent et met à jour uniquement le retrait encore en attente qui correspond au retraitId
    const updatedAgent = await Agent.findOneAndUpdate(
      { _id: agentId, retraits: { $elemMatch: { _id: retraitId, status: 'EN_ATTENTE' } } },
      { $set: updateFields },
      { new: true }
    ).populate({
      path: 'userId',
      select: 'pseudo telephone role'
    });

    if (!updatedAgent) {
      return { success: false, error: "Agent ou retrait introuvable, ou retrait déjà traité." };
    }

    return {
      success: true,
      message: `Le statut du retrait a été mis à jour avec succès en [${status}].`,
      data: JSON.parse(JSON.stringify(updatedAgent))
    };
  } catch (error: any) {
    console.error("❌ Erreur lors de la mise à jour du retrait:", error?.message);
    return { success: false, error: error.message || "Erreur lors de la modification du retrait." };
  }
}

/**
 * 6. AJOUT D'UNE DEMANDE DE RETRAIT (Par l'Agent lui-même)
 * Permet à un agent de solliciter un retrait de fonds vers son compte Mobile Money.
 * L'agent est résolu depuis la session (plus d'agentId fourni par le client).
 */
export async function addAgentRetrait(_agentId: string, amount: number) {
  try {
    const guard = await guardStaff();
    if (!guard.ok) return { success: false, error: guard.error };

    await connectToDb();

    // 1. Validations de base
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: "Le montant du retrait doit être supérieur à 0 FC." };
    }

    // 2. Trouver l'agent de la session
    const agent = await Agent.findOne({ userId: guard.session.userId });
    if (!agent) return { success: false, error: "Profil Agent introuvable." };

    // TODO(PAY-24): flux de retrait agent sans solde de commission ni validation ; à définir avant usage.

    // 3. Pousser ($push) la nouvelle demande dans le tableau des retraits
    const updatedAgent = await Agent.findByIdAndUpdate(
      agent._id,
      {
        $push: {
          retraits: {
            amount: numericAmount,
            status: 'EN_ATTENTE',
            createdAt: new Date()
          }
        }
      },
      { new: true } // Renvoie le document après modification
    ).populate({
      path: 'userId',
      select: 'pseudo role',
    });

    return {
      success: true,
      message: "Votre demande de retrait a été soumise avec succès et est en attente de validation.",
      data: JSON.parse(JSON.stringify(updatedAgent))
    };
  } catch (error: any) {
    console.error("❌ Erreur lors de l'ajout du retrait:", error?.message);
    return { success: false, error: error.message || "Erreur lors de la création de la demande de retrait." };
  }
}
