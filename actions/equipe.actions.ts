'use server';

import connectToDb from "@/lib/utils/db";
import Equipe from "@/lib/models/Equipe";
import Player from "@/lib/models/Player";
import { initiatePaymentAction, checkPaymentStatusAction } from "@/actions/payment.actions";

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
  email?: string
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
      email?.trim()
    );

    console.log("Payment initiation result:", payment);

    if (!payment.success || !payment.orderNumber) {
      return { success: false, error: payment.error || "Échec de l'initiation du paiement." };
    }

    return {
      success: true,
      orderNumber: payment.orderNumber,
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
