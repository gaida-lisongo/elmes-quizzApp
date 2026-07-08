'use server';

import { Competition } from "@/lib/models/Competition";
import Categorie from "@/lib/models/Categorie";
import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";

/**
 * Récupère toutes les compétitions ACTIVES (affichage public)
 */
export async function getCompetitionsPublic() {
  try {
    await connectToDb();
    const competitions = await Competition.find({ status: 'ACTIVE' })
      .populate('categories', 'designation slug')
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, competitions: JSON.parse(JSON.stringify(competitions)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère toutes les compétitions (admin)
 */
export async function getAllCompetitions() {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const competitions = await Competition.find()
      .populate('categories', 'designation slug')
      .sort({ createdAt: -1 })
      .lean();
    return { success: true, competitions: JSON.parse(JSON.stringify(competitions)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Récupère une compétition par son slug
 */
export async function getCompetitionBySlug(slug: string) {
  try {
    await connectToDb();
    const competition = await Competition.findOne({ slug })
      .populate('categories', 'designation slug description')
      .lean();
    if (!competition) return { success: false, error: 'Compétition introuvable' };
    return { success: true, competition: JSON.parse(JSON.stringify(competition)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crée une compétition
 */
export async function createCompetition(data: {
  designation: string;
  description: string;
  categories: string[];
  questions: number;
  cagnotte: number;
  amount: number;
  image?: string;
  slug: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const competition = await Competition.create({
      designation: data.designation,
      description: data.description,
      categories: data.categories,
      questions: data.questions || 1,
      cagnotte: data.cagnotte || 0,
      amount: data.amount || 0,
      image: data.image || '',
      slug: data.slug,
      status: 'ACTIVE',
    });
    return { success: true, competition: JSON.parse(JSON.stringify(competition)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour une compétition
 */
export async function updateCompetition(id: string, data: {
  designation?: string;
  description?: string;
  categories?: string[];
  questions?: number;
  cagnotte?: number;
  amount?: number;
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
    const competition = await Competition.findByIdAndUpdate(id, data, { new: true })
      .populate('categories', 'designation slug')
      .lean();
    if (!competition) return { success: false, error: 'Compétition introuvable' };
    return { success: true, competition: JSON.parse(JSON.stringify(competition)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Supprime une compétition
 */
export async function deleteCompetition(id: string) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    await Competition.findByIdAndDelete(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}