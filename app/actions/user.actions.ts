'use server';

import Agent from "../lib/models/Agent";
import User from "../lib/models/User";
import connectToDb from "../lib/utils/db";
import crypto from 'crypto';

interface CreateAgentParams {
  pseudo: string;
  telephone: string;
  email?: string;
  role: 'PLAYER' | 'MOD' | 'ADMIN'; // Restreint aux rôles administratifs
  secure: string; // Mot de passe en clair à chiffrer
}

/**
 * Hache un mot de passe en SHA-256 de manière native
 */
export async function hashPassword(password: string): Promise<string> {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Plus besoin de la fonction locale connectToDb, on l'appelle directement au début de chaque action :
export async function getAgents() {
  try {
    await connectToDb(); // Réutilisation du connecteur Atlas mis en cache
    
    const agents = await Agent.find().populate({
      path: 'userId'
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
    await connectToDb();

    const { pseudo, telephone, email, role, secure } = params;

    // 1. Validations de base
    if (!pseudo.trim() || !telephone.trim() || !secure.trim()) {
      return { success: false, error: "Le pseudo, le téléphone et le mot de passe sont obligatoires." };
    }

    // 2. Vérifier si un utilisateur possède déjà ce numéro de téléphone à Kinshasa
    const existingUser = await User.findOne({ telephone: telephone.trim() });
    if (existingUser) {
      return { success: false, error: "Un utilisateur existe déjà avec ce numéro de téléphone." };
    }

    // 3. Hachage du mot de passe en SHA-256
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
      path: 'userId'
    });

    return {
      success: true,
      message: `L'utilisateur ${pseudo} a été créé avec le rôle ${role} et son profil Agent a été initialisé.`,
      data: JSON.parse(JSON.stringify(populatedAgent))
    };

  } catch (error: any) {
    console.error("❌ Erreur lors de la création de l'agent:", error);
    return { success: false, error: error.message || "Une erreur est survenue lors de la création." };
  }
}

export async function updateUser(
  userId: string, 
  data: { pseudo?: string; role: 'PLAYER' | 'MOD' | 'ADMIN'; telephone?: string; email?: string; secure?: string }
) {
  try {
    await connectToDb();

    if (!userId) return { success: false, error: "L'ID de l'utilisateur est requis." };

    const updateData: any = {};
    if (data.pseudo?.trim()) updateData.pseudo = data.pseudo.trim();
    if (data.email?.trim()) updateData.email = data.email.trim();
    if(data.role?.trim()) updateData.role = data.role.trim();
    
    if (data.telephone?.trim()) {
      // Vérifier l'unicité du numéro s'il change
      const existing = await User.findOne({ telephone: data.telephone.trim(), _id: { $ne: userId } });
      if (existing) return { success: false, error: "Ce numéro de téléphone est déjà utilisé." };
      updateData.telephone = data.telephone.trim();
    }

    if (data.secure?.trim()) {
      updateData.secure = await hashPassword(data.secure);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
    
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
    await connectToDb();

    if (!userId) return { success: false, error: "L'ID de l'utilisateur est requis." };

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
    await connectToDb();

    if (!agentId) return { success: false, error: "L'ID de l'agent est requis." };

    // 1. Trouver l'agent pour récupérer son userId lié
    const agent = await Agent.findById(agentId);
    if (!agent) return { success: false, error: "Profil Agent introuvable." };

    const userId = agent.userId;

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
    await connectToDb();

    if (!agentId) return { success: false, error: "L'ID de l'agent est requis." };

    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      { $set: { permissions: permissions } },
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
    await connectToDb();

    if (!agentId || !retraitId) {
      return { success: false, error: "L'ID de l'agent et l'ID du retrait sont requis." };
    }

    // Préparation des champs à mettre à jour dynamiquement dans le sous-document
    const updateFields: any = {
      'retraits.$.status': status
    };

    // Si un ID de transaction Mobile Money (M-Pesa, Orange, Airtel) est fourni, on l'enregistre
    if (providerTxId?.trim()) {
      updateFields['retraits.$.providerTxId'] = providerTxId.trim();
    }

    // Recherche l'agent et met à jour uniquement le retrait qui correspond au retraitId
    const updatedAgent = await Agent.findOneAndUpdate(
      { _id: agentId, 'retraits._id': retraitId },
      { $set: updateFields },
      { new: true }
    ).populate({
      path: 'userId',
      select: 'pseudo telephone role'
    });

    if (!updatedAgent) {
      return { success: false, error: "Agent ou retrait introuvable." };
    }

    return {
      success: true,
      message: `Le statut du retrait a été mis à jour avec succès en [${status}].`,
      data: JSON.parse(JSON.stringify(updatedAgent))
    };
  } catch (error: any) {
    console.error("❌ Erreur lors de la mise à jour du retrait:", error);
    return { success: false, error: error.message || "Erreur lors de la modification du retrait." };
  }
}

/**
 * 6. AJOUT D'UNE DEMANDE DE RETRAIT (Par l'Agent lui-même)
 * Permet à un agent de solliciter un retrait de fonds vers son compte Mobile Money
 */
export async function addAgentRetrait(agentId: string, amount: number) {
  try {
    await connectToDb();

    // 1. Validations de base
    if (!agentId) return { success: false, error: "L'ID de l'agent est requis." };
    if (!amount || amount <= 0) return { success: false, error: "Le montant du retrait doit être supérieur à 0 FC." };

    // 2. Trouver l'agent et vérifier son solde utilisateur si nécessaire
    // (Optionnel : si tu veux lier le solde de l'User pour valider qu'il a assez de fonds)
    const agent = await Agent.findById(agentId).populate('userId');
    if (!agent) return { success: false, error: "Profil Agent introuvable." };

    // Exemple de sécurité si tu utilises le champ 'solde' de l'User connecté :
    // const user = agent.userId as any;
    // if (user && user.solde < amount) {
    //   return { success: false, error: "Solde insuffisant pour effectuer ce retrait." };
    // }

    // 3. Pousser ($push) la nouvelle demande dans le tableau des retraits
    const updatedAgent = await Agent.findByIdAndUpdate(
      agentId,
      {
        $push: {
          retraits: {
            amount: amount,
            status: 'EN_ATTENTE',
            createdAt: new Date()
            // providerTxId reste vide tant que Gaïda n'a pas validé le transfert
          }
        }
      },
      { new: true } // Renvoie le document après modification
    ).populate({
      path: 'userId'
    });

    // Déclencher une notification interne asynchrone (Webhook interne sans await)
    (async () => {
      try {
        const agentUser = updatedAgent?.userId as any;
        console.log(`[Background Notification] L'agent ${agentUser?.pseudo} demande un retrait de ${amount} FC.`);
        // Ici ton système d'envoi de mail à Gaïda/Admin pour l'avertir
      } catch (err) {
        console.error("[Background Error] Échec de la notification de retrait", err);
      }
    })();

    return {
      success: true,
      message: "Votre demande de retrait a été soumise avec succès et est en attente de validation.",
      data: JSON.parse(JSON.stringify(updatedAgent))
    };
  } catch (error: any) {
    console.error("❌ Erreur lors de l'ajout du retrait:", error);
    return { success: false, error: error.message || "Erreur lors de la création de la demande de retrait." };
  }
}