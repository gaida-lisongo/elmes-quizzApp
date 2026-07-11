'use server';

import mongoose from "mongoose";
import connectToDb from "@/lib/utils/db";
import Equipe from "@/lib/models/Equipe";
import Player from "@/lib/models/Player";
import User from "@/lib/models/User";
import EnrollementModule from "@/lib/models/Enrollement";
import { initiatePaymentAction, checkPaymentStatusAction, type PaymentMethod } from "@/actions/payment.actions";
import { getSession } from "@/lib/utils/auth";

const { Enrollement } = EnrollementModule;

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
    soldeCDF: number;
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

const TEAM_MAX_MEMBERS = 5;

const getTeamOccupancy = (equipe: any) => {
  const acceptedIds = new Set<string>();
  if (equipe.chefId) acceptedIds.add(equipe.chefId.toString());
  (equipe.membres || []).forEach((member: any) => {
    if (member.status && member.player) acceptedIds.add(member.player.toString());
  });
  const pendingInvitationsCount = (equipe.membres || []).filter((member: any) => !member.status).length;
  const acceptedMembersCount = acceptedIds.size;
  return {
    acceptedMembersCount,
    pendingInvitationsCount,
    availableSlots: TEAM_MAX_MEMBERS - (acceptedMembersCount + pendingInvitationsCount),
  };
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
    metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, soldeCDF: 0, matchsWin: 0 },
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
        soldeCDF: 0,
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
        metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, soldeCDF: 0, matchsWin: 0 },
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

export async function createPurchaseOrderAction(beneficiaryPlayerId: string, amount: number, reason: string) {
  try {
    await connectToDb();
    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findOne({
      membres: { $elemMatch: { player: currentPlayer._id, status: true, isSecretary: true } },
    });
    if (!equipe) return { success: false, error: "Seul le secrétaire actif d'une équipe peut créer un bon." };

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return { success: false, error: "Montant invalide." };
    if ((equipe.metriques?.soldeUsd || 0) < numericAmount) return { success: false, error: "Solde d'équipe insuffisant." };

    const isBeneficiaryMember = equipe.chefId.toString() === beneficiaryPlayerId
      || equipe.membres.some((member) => member.player.toString() === beneficiaryPlayerId && member.status);
    if (!isBeneficiaryMember) return { success: false, error: "Le bénéficiaire doit être membre actif de l'équipe." };

    const beneficiaryPlayer = await Player.findById(beneficiaryPlayerId).lean();
    if (!beneficiaryPlayer?.userId) return { success: false, error: "Bénéficiaire introuvable." };

    if (!equipe.purchaseOrders) equipe.purchaseOrders = [] as any;
    equipe.purchaseOrders.push({
      createdBy: currentPlayer._id,
      beneficiaryUserId: beneficiaryPlayer.userId,
      beneficiaryPlayerId: beneficiaryPlayer._id,
      amount: numericAmount,
      reason: reason?.trim() || "Bon de commande équipe",
      status: "pending",
      createdAt: new Date(),
    });
    await equipe.save();

    return { success: true, message: "Bon de commande créé." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur création bon." };
  }
}

export async function approvePurchaseOrderAction(orderId: string) {
  try {
    await connectToDb();
    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findOne({ chefId: currentPlayer._id, "purchaseOrders._id": orderId });
    if (!equipe) return { success: false, error: "Seul le capitaine peut valider ce bon." };

    const order: any = (equipe.purchaseOrders as any).id(orderId);
    if (!order) return { success: false, error: "Bon introuvable." };
    if (order.status !== "pending" || order.creditedAt) return { success: false, error: "Ce bon a déjà été traité." };
    if ((equipe.metriques?.soldeUsd || 0) < order.amount) return { success: false, error: "Solde d'équipe insuffisant." };

    const isBeneficiaryMember = equipe.chefId.toString() === order.beneficiaryPlayerId.toString()
      || equipe.membres.some((member) => member.player.toString() === order.beneficiaryPlayerId.toString() && member.status);
    if (!isBeneficiaryMember) return { success: false, error: "Le bénéficiaire n'est plus membre actif de l'équipe." };

    // TODO: créer une transaction interne dédiée si un modèle Transaction global est ajouté au projet.
    await User.findByIdAndUpdate(order.beneficiaryUserId, { $inc: { solde: order.amount } });
    equipe.metriques.soldeUsd = Math.max(0, (equipe.metriques.soldeUsd || 0) - order.amount);
    order.status = "approved";
    order.approvedBy = currentPlayer._id;
    order.approvedAt = new Date();
    order.creditedAt = new Date();
    await equipe.save();

    return { success: true, message: "Bon validé et solde membre crédité." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur validation bon." };
  }
}

export async function rejectPurchaseOrderAction(orderId: string) {
  try {
    await connectToDb();
    const currentPlayer = await getCurrentPlayer();
    if (!currentPlayer) return { success: false, error: "Profil joueur introuvable." };

    const equipe = await Equipe.findOne({ chefId: currentPlayer._id, "purchaseOrders._id": orderId });
    if (!equipe) return { success: false, error: "Seul le capitaine peut refuser ce bon." };

    const order: any = (equipe.purchaseOrders as any).id(orderId);
    if (!order) return { success: false, error: "Bon introuvable." };
    if (order.status !== "pending" || order.creditedAt) return { success: false, error: "Ce bon a déjà été traité." };

    order.status = "rejected";
    order.approvedBy = currentPlayer._id;
    order.approvedAt = new Date();
    await equipe.save();

    return { success: true, message: "Bon refusé." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur refus bon." };
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
    if (getTeamOccupancy(equipe).availableSlots <= 0) {
      return { success: false, error: "Cette équipe a déjà atteint la limite de 5 membres ou possède trop d'invitations en attente." };
    }

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

    const activeIds = new Set<string>();
    if (equipe.chefId) activeIds.add(equipe.chefId.toString());
    equipe.membres.forEach((member) => {
      if (member.status && member.player) activeIds.add(member.player.toString());
    });
    const activeCount = activeIds.size;
    if (activeCount >= TEAM_MAX_MEMBERS) {
      equipe.membres.splice(memberIndex, 1);
      await equipe.save();
      return { success: false, error: "Cette équipe a déjà atteint la limite de 5 membres ou possède trop d'invitations en attente." };
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

const ensureAdminSession = async () => {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
};

const mapTeamSummary = (equipe: any) => {
  const activeMemberIds = new Set<string>();
  if (equipe.chefId?._id) activeMemberIds.add(equipe.chefId._id.toString());
  (equipe.membres || []).forEach((member: any) => {
    if (member.status && member.player?._id) activeMemberIds.add(member.player._id.toString());
  });

  const captainPseudo = equipe.chefId?.userId?.pseudo || "—";
  const pendingInvitationsCount = (equipe.membres || []).filter((member: any) => !member.status).length;

  return {
    _id: equipe._id.toString(),
    designation: equipe.designation,
    description: Array.isArray(equipe.description) ? equipe.description : [],
    logo: equipe.logo || "",
    status: equipe.status || "ACTIVE",
    captain: {
      _id: equipe.chefId?._id?.toString?.() || "",
      pseudo: captainPseudo,
    },
    membersCount: activeMemberIds.size,
    pendingInvitationsCount,
    soldeUsd: equipe.metriques?.soldeUsd || 0,
    competitions: equipe.metriques?.competitions || 0,
    matchsWin: equipe.metriques?.matchsWin || 0,
    createdAt: equipe.createdAt?.toISOString?.() || "",
  };
};

export async function getTeamsAdminAction(query: string = "") {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const search = query.trim();
    const filter: any = {};
    if (search.length >= 2) {
      filter.designation = new RegExp(search, "i");
    }

    const equipes = await Equipe.find(filter)
      .populate({ path: "chefId", populate: { path: "userId", select: "pseudo photo telephone" } })
      .populate({ path: "membres.player", populate: { path: "userId", select: "pseudo photo telephone" } })
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      data: equipes.map((equipe: any) => mapTeamSummary(equipe)),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de chargement des équipes." };
  }
}

export async function getTeamAdminDetailAction(teamId: string) {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const equipe = await Equipe.findById(teamId)
      .populate({ path: "chefId", populate: { path: "userId", select: "pseudo photo telephone email" } })
      .populate({ path: "membres.player", populate: { path: "userId", select: "pseudo photo telephone email" } })
      .lean();

    if (!equipe) return { success: false, error: "Équipe introuvable." };

    const enrollments = await Enrollement.find({ equipeId: equipe._id })
      .populate("sessionId", "designation status type startDate endDate")
      .populate("competitionId", "designation slug")
      .sort({ createdAt: -1 })
      .lean();

    const members = (equipe.membres || []).map((member: any) => ({
      _id: member.player?._id?.toString?.() || member.player?.toString?.() || "",
      pseudo: member.player?.userId?.pseudo || "Membre",
      telephone: member.player?.userId?.telephone || "",
      email: member.player?.userId?.email || "",
      isSecretary: Boolean(member.isSecretary),
      status: Boolean(member.status),
      isCaptain: equipe.chefId?._id?.toString?.() === member.player?._id?.toString?.(),
    }));

    const invitations = members.filter((member: any) => !member.status);

    const competitions = Array.from(
      new Map(
        (enrollments || [])
          .filter((enrollment: any) => enrollment.competitionId)
          .map((enrollment: any) => [
            enrollment.competitionId?._id?.toString?.() || enrollment.competitionId?.toString?.(),
            {
              _id: enrollment.competitionId?._id?.toString?.() || enrollment.competitionId?.toString?.(),
              designation: enrollment.competitionId?.designation || "Compétition",
              session: enrollment.sessionId?.designation || "Session",
              status: enrollment.sessionId?.status || enrollment.status || "PENDING",
            },
          ]),
      ).values(),
    );

    return {
      success: true,
      data: {
        _id: equipe._id.toString(),
        designation: equipe.designation,
        description: Array.isArray(equipe.description) ? equipe.description : [],
        logo: equipe.logo || "",
        status: equipe.status || "ACTIVE",
        captain: {
          _id: (equipe.chefId as any)?._id?.toString?.() || "",
          pseudo: (equipe.chefId as any)?.userId?.pseudo || "Capitaine",
        },
        members,
        invitations,
        enrollments: JSON.parse(JSON.stringify(enrollments || [])),
        competitions,
        metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, soldeCDF: 0, matchsWin: 0 },
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de chargement." };
  }
}

export async function updateTeamAdminAction(
  teamId: string,
  data: { designation?: string; description?: string; logo?: string; status?: "ACTIVE" | "INACTIVE" | "ARCHIVED" },
) {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const equipe = await Equipe.findById(teamId);
    if (!equipe) return { success: false, error: "Équipe introuvable." };

    if (data.designation?.trim()) equipe.designation = data.designation.trim();
    if (data.description !== undefined) equipe.description = data.description.trim() ? [data.description.trim()] : [];
    if (data.logo !== undefined) equipe.logo = data.logo.trim();
    if (data.status) equipe.status = data.status;
    if (data.status === "ARCHIVED") equipe.archivedAt = new Date();
    if (data.status && data.status !== "ARCHIVED") equipe.archivedAt = undefined;

    await equipe.save();

    return { success: true, message: "Équipe mise à jour." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de mise à jour." };
  }
}

export async function changeTeamCaptainAdminAction(teamId: string, playerId: string) {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const equipe = await Equipe.findById(teamId);
    if (!equipe) return { success: false, error: "Équipe introuvable." };

    const isMember = equipe.chefId?.toString?.() === playerId
      || (equipe.membres || []).some((member: any) => member.player?.toString?.() === playerId && member.status);
    if (!isMember) return { success: false, error: "Le nouveau capitaine doit déjà être membre de l'équipe." };

    equipe.chefId = new mongoose.Types.ObjectId(playerId);
    const member = (equipe.membres || []).find((item: any) => item.player?.toString?.() === playerId);
    if (member) {
      member.status = true;
    }

    await equipe.save();
    return { success: true, message: "Capitaine mis à jour." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de changement de capitaine." };
  }
}

export async function toggleTeamStatusAdminAction(teamId: string, status: "ACTIVE" | "INACTIVE" | "ARCHIVED") {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const equipe = await Equipe.findById(teamId);
    if (!equipe) return { success: false, error: "Équipe introuvable." };

    equipe.status = status;
    equipe.archivedAt = status === "ARCHIVED" ? new Date() : undefined;
    await equipe.save();

    return { success: true, message: "Statut de l'équipe mis à jour." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de mise à jour." };
  }
}

export async function removeTeamMemberAdminAction(teamId: string, playerId: string) {
  try {
    const session = await ensureAdminSession();
    if (!session) return { success: false, error: "Accès réservé à l'administration." };

    await connectToDb();
    const equipe = await Equipe.findById(teamId);
    if (!equipe) return { success: false, error: "Équipe introuvable." };

    if (equipe.chefId?.toString?.() === playerId) {
      return { success: false, error: "Le capitaine ne peut pas être retiré directement." };
    }

    const memberIndex = (equipe.membres || []).findIndex((member: any) => member.player?.toString?.() === playerId);
    if (memberIndex === -1) return { success: false, error: "Membre introuvable." };

    equipe.membres.splice(memberIndex, 1);
    await equipe.save();

    return { success: true, message: "Membre retiré." };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur de suppression du membre." };
  }
}
