'use server';

import connectToDb from "@/lib/utils/db";
import Equipe from "@/lib/models/Equipe";
import Player from "@/lib/models/Player";
import User from "@/lib/models/User";
import { initiatePaymentAction, checkPaymentStatusAction, type PaymentMethod } from "@/actions/payment.actions";
import { getSession } from "@/lib/utils/auth";

export type EquipeSummary = {
  _id: string;
  designation: string;
  description: string[];
  logo: string;
  chefId?: {
    _id: string;
    userId?: {
      _id: string;
      pseudo: string;
      telephone: string;
      photo?: string;
    };
  };
  membres: Array<{ player: string; status: boolean; isSecretary: boolean }>;
  metriques: {
    competitions: number;
    soldeUsd: number;
    matchsWin: number;
  };
  payment: Array<{ orderNumber: string; status: string; providerText: string }>;
  createdAt: string;
};

const getCurrentPlayer = async () => {
  const session = await getSession();
  if (!session) return null;
  return Player.findOne({ userId: session.userId }).lean();
};

const serializeEquipe = (equipe: any) => {
  const toPlainString = (value: unknown) => {
    if (typeof value === "string") return value;
    if (value && typeof value === "object" && "toString" in value) {
      const candidate = value.toString();
      return candidate && candidate !== "[object Object]" ? candidate : "";
    }
    return value ? String(value) : "";
  };

  return {
    _id: equipe._id.toString(),
    designation: equipe.designation,
    description: Array.isArray(equipe.description) ? equipe.description : [],
    logo: equipe.logo || "",
    chefId: equipe.chefId
      ? {
          _id: equipe.chefId._id.toString(),
          userId: equipe.chefId.userId
            ? {
                _id: equipe.chefId.userId._id.toString(),
                pseudo: equipe.chefId.userId.pseudo,
                telephone: equipe.chefId.userId.telephone,
                photo: typeof equipe.chefId.userId.photo === "string" ? equipe.chefId.userId.photo : "",
              }
            : undefined,
        }
      : undefined,
    membres: (equipe.membres || []).map((membre: any) => ({
      player: toPlainString(membre.player),
      status: Boolean(membre.status),
      isSecretary: Boolean(membre.isSecretary),
    })),
    metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, matchsWin: 0 },
    payment: (equipe.payment || []).map((item: any) => ({
      orderNumber: item.orderNumber,
      status: item.status,
      providerText: item.providerText,
    })),
    createdAt: equipe.createdAt?.toISOString?.() || "",
  };
};

export async function getEquipesAction() {
  try {
    await connectToDb();

    const equipes = await Equipe.find({})
      .sort({ createdAt: -1 })
      .populate({
        path: "chefId",
        populate: { path: "userId", select: "pseudo photo telephone" },
      })
      .lean();

    return {
      success: true,
      equipes: equipes.map((equipe: any) => serializeEquipe(equipe)),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Impossible de charger les équipes." };
  }
}

export async function initiateEquipeCreationAction(
  captainId: string,
  designation: string,
  description: string,
  logo: string,
  phone: string,
  email?: string,
  paymentMethod: PaymentMethod = "MOBILE_MONEY",
) {
  try {
    await connectToDb();

    const captain = await Player.findById(captainId);
    if (!captain) {
      return { success: false, error: "Le capitaine n'existe pas." };
    }

    if (captain.type !== "VIP") {
      return { success: false, error: "Seuls les joueurs de type VIP peuvent créer une équipe." };
    }

    const cleanDesignation = designation.trim();
    const cleanDescription = description.trim();
    const cleanLogo = logo.trim();

    if (!cleanDesignation || !cleanDescription) {
      return { success: false, error: "La désignation et la description sont obligatoires." };
    }

    const payment = await initiatePaymentAction(
      captainId,
      phone,
      2500,
      "CDF",
      {
        id: `team-${Date.now()}`,
        name: "Création d'équipe",
        amountCDF: 2500,
        amountUSD: 1,
        type: "EQUIPE",
        metadata: {
          captainId,
          designation: cleanDesignation,
          description: cleanDescription,
          logo: cleanLogo,
        },
      },
      email?.trim(),
      paymentMethod,
    );

    console.log("Payment initiation result:", payment);

    if (!payment.success || !payment.orderNumber) {
      return { success: false, error: payment.error || "Échec de l'initiation du paiement." };
    }

    return {
      success: true,
      orderNumber: payment.orderNumber,
      redirectUrl: payment.redirectUrl,
      paymentMethod,
      message: "Paiement initié. Vérifiez ensuite la confirmation pour finaliser l'équipe.",
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur serveur lors de l'initiation." };
  }
}

export async function confirmEquipeCreationAction(payload: {
  captainId: string;
  designation: string;
  description: string;
  logo: string;
  orderNumber: string;
  email?: string;
}): Promise<{ success: true; equipe: EquipeSummary } | { success: false; error: string }> {
  try {
    await connectToDb();

    const status = await checkPaymentStatusAction(payload.orderNumber, payload.email, "Création d'équipe");
    if (!status.success || status.status !== "SUCCES") {
      return {
        success: false,
        error: status.error || "Le paiement n'est pas encore confirmé.",
      };
    }

    const captain = await Player.findById(payload.captainId);
    if (!captain) {
      return { success: false, error: "Le capitaine n'existe pas." };
    }

    if (captain.type !== "VIP") {
      return { success: false, error: "Seuls les joueurs de type VIP peuvent créer une équipe." };
    }

    const existingEquipe = await Equipe.findOne({
      designation: new RegExp(`^${payload.designation.trim()}$`, "i"),
    });

    if (existingEquipe) {
      return { success: false, error: "Une équipe portant cette désignation existe déjà." };
    }

    const equipe = await Equipe.create({
      chefId: payload.captainId,
      designation: payload.designation.trim(),
      description: [payload.description.trim()],
      logo: payload.logo.trim(),
      payment: [
        {
          orderNumber: payload.orderNumber,
          status: "CONFIRMED",
          providerText: "Mobile Money",
        },
      ],
      membres: [{ player: payload.captainId, status: true, isSecretary: true }],
      metriques: {
        competitions: 0,
        soldeUsd: 0,
        matchsWin: 0,
      },
    });

    const latestRecharge = captain.recharges?.slice(-1)[0];
    if (latestRecharge?.providerTxId === payload.orderNumber) {
      latestRecharge.status = "SUCCES";
      await captain.save();
    }

    return {
      success: true,
      equipe: {
        _id: equipe._id.toString(),
        designation: equipe.designation,
        description: equipe.description || [],
        logo: equipe.logo || "",
        chefId: {
          _id: equipe.chefId.toString(),
          userId: undefined,
        },
        membres: (equipe.membres || []).map((membre: any) => ({
          player: membre.player?.toString?.() || "",
          status: membre.status,
          isSecretary: membre.isSecretary,
        })),
        metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, matchsWin: 0 },
        payment: (equipe.payment || []).map((item: any) => ({
          orderNumber: item.orderNumber,
          status: item.status,
          providerText: item.providerText,
        })),
        createdAt: equipe.createdAt?.toISOString?.() || "",
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur serveur lors de la confirmation." };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  GESTION DES MEMBRES D'ÉQUIPE
// ═══════════════════════════════════════════════════════════════════

/**
 * Invite un joueur à rejoindre une équipe.
 * Ajoute le membre dans l'équipe avec status=false (en attente).
 */
export async function searchInvitableVipPlayersAction(query: string) {
  try {
    await connectToDb();

    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findOne({ chefId: currentPlayer._id }).lean();
    if (!equipe) return { success: false, error: "Seul le capitaine peut inviter des joueurs." };

    if (!query || query.trim().length < 2) return { success: true, players: [] };

    const searchRegex = new RegExp(query.trim(), "i");
    const users = await User.find({
      $or: [{ pseudo: searchRegex }, { telephone: searchRegex }, { email: searchRegex }],
    }).select("pseudo telephone email photo").limit(12).lean();

    const vipPlayers = await Player.find({
      userId: { $in: users.map((user: any) => user._id) },
      type: "VIP",
      _id: { $ne: currentPlayer._id },
    }).populate("userId", "pseudo telephone email photo").lean();

    const playerIds = vipPlayers.map((player: any) => player._id);
    const unavailableTeams = await Equipe.find({
      $or: [
        { chefId: { $in: playerIds } },
        { membres: { $elemMatch: { player: { $in: playerIds } } } },
      ],
    }).select("chefId membres").lean();

    const unavailableIds = new Set<string>();
    unavailableTeams.forEach((team: any) => {
      if (team.chefId) unavailableIds.add(team.chefId.toString());
      (team.membres || []).forEach((member: any) => {
        if (member.player) unavailableIds.add(member.player.toString());
      });
    });

    return {
      success: true,
      players: vipPlayers
        .filter((player: any) => !unavailableIds.has(player._id.toString()))
        .map((player: any) => ({
          _id: player._id.toString(),
          pseudo: player.userId?.pseudo || "Joueur",
          telephone: player.userId?.telephone || "",
          email: player.userId?.email || "",
          photo: player.userId?.photo || "",
        })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de recherche." };
  }
}

export async function inviteMemberAction(equipeId: string, playerId: string) {
  try {
    await connectToDb();

    const equipe = await Equipe.findById(equipeId);
    const currentPlayer = await getCurrentPlayer();
    if (equipe && (!currentPlayer || equipe.chefId.toString() !== currentPlayer._id.toString())) {
      return { success: false, error: 'Seul le capitaine peut inviter un joueur.' };
    }
    if (!equipe) return { success: false, error: 'Équipe introuvable.' };

    const player = await Player.findById(playerId);
    if (player && player.type !== 'VIP') {
      return { success: false, error: 'Seuls les joueurs VIP peuvent rejoindre une Ã©quipe.' };
    }
    if (player) {
      const alreadyInTeam = await Equipe.findOne({
        $or: [
          { chefId: player._id },
          { membres: { $elemMatch: { player: player._id } } },
        ],
      }).lean();
      if (alreadyInTeam) {
        return { success: false, error: 'Ce joueur est dÃ©jÃ  dans une Ã©quipe ou capitaine d\'une autre Ã©quipe.' };
      }
    }
    if (!player) return { success: false, error: 'Joueur introuvable.' };

    const alreadyMember = equipe.membres.some((m) => m.player.toString() === playerId);
    if (alreadyMember) return { success: false, error: 'Ce joueur est déjà dans l\'équipe.' };

    equipe.membres.push({ player: player._id, status: false, isSecretary: false });
    await equipe.save();

    return { success: true, message: 'Invitation envoyée.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur lors de l\'invitation.' };
  }
}

/**
 * Met à jour le rôle d'un membre (secrétaire ou révoquer).
 * Seul le capitaine peut faire cette action.
 */
export async function respondEquipeInvitationAction(
  equipeId: string,
  response: 'ACCEPT' | 'DECLINE',
) {
  try {
    await connectToDb();

    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findOne({
      _id: equipeId,
      membres: { $elemMatch: { player: currentPlayer._id, status: false } },
    });
    if (!equipe) return { success: false, error: "Invitation introuvable." };

    const memberIndex = equipe.membres.findIndex((member) => member.player.toString() === currentPlayer._id.toString());
    if (memberIndex === -1) return { success: false, error: "Invitation introuvable." };

    if (response === "DECLINE") {
      equipe.membres.splice(memberIndex, 1);
      await equipe.save();
      return { success: true, message: "Invitation refusee." };
    }

    equipe.membres[memberIndex].status = true;
    await equipe.save();
    return { success: true, message: "Invitation acceptee." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de traitement." };
  }
}

export async function leaveEquipeAction(equipeId: string) {
  try {
    await connectToDb();

    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findById(equipeId);
    if (!equipe) return { success: false, error: "Equipe introuvable." };
    if (equipe.chefId.toString() === currentPlayer._id.toString()) {
      return { success: false, error: "Le capitaine ne peut pas quitter son equipe." };
    }

    const memberIndex = equipe.membres.findIndex((member) => member.player.toString() === currentPlayer._id.toString());
    if (memberIndex === -1) return { success: false, error: "Vous n'etes pas membre de cette equipe." };

    equipe.membres.splice(memberIndex, 1);
    await equipe.save();
    return { success: true, message: "Vous avez quitte l'equipe." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur lors du retrait." };
  }
}

export async function updateMemberRoleAction(
  equipeId: string,
  playerId: string,
  action: 'SET_SECRETARY' | 'UNSET_SECRETARY' | 'REVOKE',
) {
  try {
    await connectToDb();

    const equipe = await Equipe.findById(equipeId);
    if (!equipe) return { success: false, error: 'Équipe introuvable.' };

    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer || equipe.chefId.toString() !== currentPlayer._id.toString()) {
      return { success: false, error: 'Seul le capitaine peut modifier les rÃ´les.' };
    }

    const membreIndex = equipe.membres.findIndex((m) => m.player.toString() === playerId);
    if (membreIndex === -1) return { success: false, error: 'Membre introuvable dans l\'équipe.' };

    if (action === 'REVOKE') {
      equipe.membres.splice(membreIndex, 1);
    } else if (action === 'SET_SECRETARY') {
      equipe.membres[membreIndex].isSecretary = true;
    } else if (action === 'UNSET_SECRETARY') {
      equipe.membres[membreIndex].isSecretary = false;
    }

    await equipe.save();
    return { success: true, message: 'Membre mis à jour avec succès.' };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de mise à jour.' };
  }
}

/**
 * Récupère l'équipe d'un joueur avec tous les détails des membres.
 */
export async function getMyEquipeDetailAction(playerId: string) {
  try {
    await connectToDb();

    const equipe = await Equipe.findOne({ membres: { $elemMatch: { player: playerId } } })
      .populate({
        path: 'membres.player',
        populate: { path: 'userId', select: 'pseudo photo telephone' },
      })
      .populate({ path: 'chefId', populate: { path: 'userId', select: 'pseudo photo telephone' } })
      .lean();

    if (!equipe) return { success: false, error: 'Aucune équipe trouvée.' };

    const isCaptain = equipe.chefId?._id?.toString() === playerId;

    const membres = (equipe.membres || []).map((m: any) => ({
      _id: m.player?._id?.toString() || '',
      pseudo: m.player?.userId?.pseudo || 'Inconnu',
      telephone: m.player?.userId?.telephone || '',
      photo: m.player?.userId?.photo || '',
      status: Boolean(m.status),
      isSecretary: Boolean(m.isSecretary),
      isCurrentUser: m.player?._id?.toString() === playerId,
    }));

    return {
      success: true,
      data: {
        _id: equipe._id.toString(),
        designation: equipe.designation,
        description: equipe.description || [],
        logo: equipe.logo || '',
        isCaptain,
        isSecretary: membres.some((m) => m.isCurrentUser && m.isSecretary),
        chefPseudo: (equipe.chefId as any)?.userId?.pseudo || 'Capitaine',
        membres,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erreur de récupération.' };
  }
}
