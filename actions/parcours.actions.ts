'use server';

import { Parcours } from "@/lib/models/Competition";
import Categorie from "@/lib/models/Categorie";
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";

/**
 * Récupère tous les parcours ACTIFS (pour l'affichage public)
 */
export async function getParcoursPublic() {
  try {
    await connectToDb();
    const parcours = await Parcours.find({ status: 'ACTIVE' })
      .populate('categories', 'designation slug description')
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, parcours: JSON.parse(JSON.stringify(parcours)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère tous les parcours (admin)
 */
export async function getAllParcours() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const parcours = await Parcours.find()
      .populate('categories', 'designation slug description')
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, parcours: JSON.parse(JSON.stringify(parcours)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère un parcours par son slug
 */
export async function getParcoursBySlug(slug: string) {
  try {
    await connectToDb();
    const parcours = await Parcours.findOne({ slug })
      .populate('categories', 'designation slug description')
      .lean();
    if (!parcours) return { success: false, error: 'Parcours introuvable' };
    return { success: true, parcours: JSON.parse(JSON.stringify(parcours)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée un parcours (admin uniquement)
 */
export async function createParcours(data: {
  designation: string;
  description: string;
  ressources?: string;
  categories: string[];
  questions: number;
  image?: string;
  slug: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const parcours = await Parcours.create({
      designation: data.designation,
      description: data.description,
      ressources: data.ressources || '',
      categories: data.categories,
      questions: data.questions || 1,
      image: data.image || '',
      slug: data.slug,
      status: 'ACTIVE',
    });
    return { success: true, parcours: JSON.parse(JSON.stringify(parcours)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour un parcours
 */
export async function updateParcours(id: string, data: {
  designation?: string;
  description?: string;
  ressources?: string;
  categories?: string[];
  questions?: number;
  image?: string;
  slug?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const parcours = await Parcours.findByIdAndUpdate(id, data, { new: true })
      .populate('categories', 'designation slug description')
      .lean();
    if (!parcours) return { success: false, error: 'Parcours introuvable' };
    return { success: true, parcours: JSON.parse(JSON.stringify(parcours)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un parcours
 */
export async function deleteParcours(id: string) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    await Parcours.findByIdAndDelete(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les catégories pour le formulaire
 */
export async function getCategoriesForForm() {
  try {
    await connectToDb();
    const categories = await Categorie.find({ status: true }).select('designation slug description').lean();
    return { success: true, categories: JSON.parse(JSON.stringify(categories)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
