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

/* ================================================================
   VALEURS – CRUD
   ================================================================ */

/**
 * Récupère toutes les valeurs
 */
export async function getValeurs() {
  try {
    await connectToDb();
    const landing = await LandingPage.findOne().lean();
    return { success: true, valeurs: landing?.values || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Ajoute une nouvelle valeur
 */
export async function addValeur(data: {
  title: string;
  description: string;
  imageUrl: string;
}) {
  try {
    await connectToDb();

    let landing = await LandingPage.findOne();
    if (!landing) {
      landing = new LandingPage({ promises: [], values: [], team: [], aboutElmes: { title: "", description: "" } });
    }

    landing.values.push({
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
    });

    await landing.save();

    const valeurs = JSON.parse(JSON.stringify(landing.toObject().values));

    return { success: true, valeurs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Modifie une valeur existante
 */
export async function updateValeur(
  index: number,
  data: {
    title: string;
    description: string;
    imageUrl: string;
  }
) {
  try {
    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.values.length) {
      return { success: false, error: "Index de valeur invalide" };
    }

    landing.values[index] = {
      title: data.title,
      description: data.description,
      imageUrl: data.imageUrl,
    };

    await landing.save();

    const valeurs = JSON.parse(JSON.stringify(landing.toObject().values));

    return { success: true, valeurs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime une valeur
 */
export async function deleteValeur(index: number) {
  try {
    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.values.length) {
      return { success: false, error: "Index de valeur invalide" };
    }

    landing.values.splice(index, 1);
    await landing.save();

    const valeurs = JSON.parse(JSON.stringify(landing.toObject().values));

    return { success: true, valeurs };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ================================================================
   ÉQUIPE (TEAM) – CRUD
   ================================================================ */

/**
 * Récupère tous les membres de l'équipe
 */
export async function getTeam() {
  try {
    await connectToDb();
    const landing = await LandingPage.findOne().lean();
    return { success: true, team: landing?.team || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Ajoute un membre à l'équipe
 */
export async function addTeamMember(data: {
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
}) {
  try {
    await connectToDb();

    let landing = await LandingPage.findOne();
    if (!landing) {
      landing = new LandingPage({ promises: [], values: [], team: [], aboutElmes: { title: "", description: "" } });
    }

    landing.team.push({
      name: data.name,
      role: data.role,
      imageUrl: data.imageUrl,
      bio: data.bio,
    });

    await landing.save();

    const team = JSON.parse(JSON.stringify(landing.toObject().team));

    return { success: true, team };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Modifie un membre de l'équipe
 */
export async function updateTeamMember(
  index: number,
  data: {
    name: string;
    role: string;
    imageUrl: string;
    bio: string;
  }
) {
  try {
    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.team.length) {
      return { success: false, error: "Index de membre invalide" };
    }

    landing.team[index] = {
      name: data.name,
      role: data.role,
      imageUrl: data.imageUrl,
      bio: data.bio,
    };

    await landing.save();

    const team = JSON.parse(JSON.stringify(landing.toObject().team));

    return { success: true, team };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un membre de l'équipe
 */
export async function deleteTeamMember(index: number) {
  try {
    await connectToDb();

    const landing = await LandingPage.findOne();
    if (!landing) {
      return { success: false, error: "Page d'accueil non trouvée" };
    }

    if (index < 0 || index >= landing.team.length) {
      return { success: false, error: "Index de membre invalide" };
    }

    landing.team.splice(index, 1);
    await landing.save();

    const team = JSON.parse(JSON.stringify(landing.toObject().team));

    return { success: true, team };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}