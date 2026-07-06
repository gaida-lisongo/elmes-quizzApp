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
      equipes: equipes.map((equipe: any) => ({
        _id: equipe._id.toString(),
        designation: equipe.designation,
        description: equipe.description || [],
        logo: equipe.logo || "",
        chefId: equipe.chefId
          ? {
              _id: equipe.chefId._id.toString(),
              userId: equipe.chefId.userId
                ? {
                    _id: equipe.chefId.userId._id.toString(),
                    pseudo: equipe.chefId.userId.pseudo,
                    telephone: equipe.chefId.userId.telephone,
                    photo: equipe.chefId.userId.photo,
                  }
                : undefined,
            }
          : undefined,
        membres: equipe.membres || [],
        metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, matchsWin: 0 },
        payment: equipe.payment || [],
        createdAt: equipe.createdAt?.toISOString?.() || "",
      })),
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
  phone: string
) {
  try {
    await connectToDb();

    const captain = await Player.findById(captainId);
    if (!captain) {
      return { success: false, error: "Le capitaine n'existe pas." };
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
      }
    );

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
}) {
  try {
    await connectToDb();

    const status = await checkPaymentStatusAction(payload.orderNumber);
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
        membres: equipe.membres || [],
        metriques: equipe.metriques || { competitions: 0, soldeUsd: 0, matchsWin: 0 },
        payment: equipe.payment || [],
        createdAt: equipe.createdAt?.toISOString?.() || "",
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || "Erreur serveur lors de la confirmation." };
  }
}
