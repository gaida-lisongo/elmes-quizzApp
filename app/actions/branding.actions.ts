"use server";

import { LandingPage } from "@/lib/models/Landing";
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";

/**
 * Récupère toutes les promesses de la landing page
 */
export async function getPromesses() {
  try {
    await connectToDb();
    const landing = await LandingPage.findOne().lean();
    return { success: true, promesses: landing?.promises || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Ajoute une nouvelle promesse
 */
export async function addPromesse(data: {
  title: string;
  description: string;
  ctaUrl: string;
  ctaLabel: string;
  imageUrl: string;
}) {
  try {
    const session = await getSession();
    // if (!session || session.role !== "ADMIN") {
    //   return { success: false, error: "Non autorisé" };
    // }

    await connectToDb();

    let landing = await LandingPage.findOne();
    if (!landing) {
      landing = new LandingPage({ promises: [], values: [], team: [], aboutElmes: { title: "", description: "" } });
    }

    landing.promises.push({
      title: data.title,
      description: data.description,
      cta: {
        url: data.ctaUrl,
        label: data.ctaLabel,
      },
      imageUrl: data.imageUrl,
    });

    await landing.save();

    const promesses = JSON.parse(JSON.stringify(landing.toObject().promises));

    return { success: true, promesses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Modifie une promesse existante
 */
export async function updatePromesse(
  index: number,
  data: {
    title: string;
    description: string;
    ctaUrl: string;
    ctaLabel: string;
    imageUrl: string;
  }
) {
  try {
    const session = await getSession();
    // if (!session || session.role !== "ADMIN") {
    //   return { success: false, error: "Non autorisé" };
    // }

    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.promises.length) {
      return { success: false, error: "Index de promesse invalide" };
    }

    landing.promises[index] = {
      title: data.title,
      description: data.description,
      cta: {
        url: data.ctaUrl,
        label: data.ctaLabel,
      },
      imageUrl: data.imageUrl,
    };

    await landing.save();

    const promesses = JSON.parse(JSON.stringify(landing.toObject().promises));

    return { success: true, promesses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime une promesse
 */
export async function deletePromesse(index: number) {
  try {
    const session = await getSession();
    // if (!session || session.role !== "ADMIN") {
    //   return { success: false, error: "Non autorisé" };
    // }

    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.promises.length) {
      return { success: false, error: "Index de promesse invalide" };
    }

    landing.promises.splice(index, 1);
    await landing.save();

    const promesses = JSON.parse(JSON.stringify(landing.toObject().promises));

    return { success: true, promesses };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
