'use server';

import connectToDb from "@/lib/utils/db";
import { getSession } from "@/lib/utils/auth";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";

/* ================================================================
   CATÉGORIES – CRUD
   ================================================================ */

export async function getCategoriesAction() {
  try {
    await connectToDb();
    const categories = await Categorie.find().sort({ designation: 1 }).lean();
    return { success: true, categories: JSON.parse(JSON.stringify(categories)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createCategorieAction(data: {
  designation: string;
  description?: string;
  slug: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    // Vérifier unicité
    const existing = await Categorie.findOne({
      $or: [{ designation: data.designation }, { slug: data.slug }],
    }).lean();
    if (existing) {
      return { success: false, error: 'Une catégorie avec ce nom ou ce slug existe déjà.' };
    }

    const cat = await Categorie.create({
      designation: data.designation,
      description: data.description || '',
      slug: data.slug,
      status: true,
    });
    return { success: true, categorie: JSON.parse(JSON.stringify(cat)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateCategorieAction(id: string, data: {
  designation?: string;
  description?: string;
  status?: boolean;
  slug?: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();

    const cat = await Categorie.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    if (!cat) return { success: false, error: 'Catégorie introuvable' };
    return { success: true, categorie: JSON.parse(JSON.stringify(cat)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteCategorieAction(id: string) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    await Categorie.findByIdAndDelete(id);
    // Supprimer aussi les quiz liés
    await Quiz.deleteMany({ categorieId: id });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/* ================================================================
   QUIZ – CRUD
   ================================================================ */

export async function getQuizzesByCategorieAction(categorieId: string) {
  try {
    await connectToDb();
    const quizzes = await Quiz.find({ categorieId })
      .sort({ level: 1, createdAt: -1 })
      .lean();
    return { success: true, quizzes: JSON.parse(JSON.stringify(quizzes)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getQuizByIdAction(id: string) {
  try {
    await connectToDb();
    const quiz = await Quiz.findById(id).populate('categorieId', 'designation').lean();
    if (!quiz) return { success: false, error: 'Question introuvable' };
    return { success: true, quiz: JSON.parse(JSON.stringify(quiz)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createQuizAction(data: {
  categorieId: string;
  enonce: string;
  assertions: string[];
  reponse: string;
  level: number;
  type: 'QCM' | 'VRAI_FAUX';
  assets?: string;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const quiz = await Quiz.create({
      categorieId: data.categorieId,
      enonce: data.enonce,
      assertions: data.assertions,
      reponse: data.reponse,
      level: data.level as 0 | 1 | 2 | 3,
      type: data.type,
      assets: data.assets || '',
      status: true,
    });
    return { success: true, quiz: JSON.parse(JSON.stringify(quiz)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createQuizzesBulkAction(quizzes: Array<{
  categorieId: string;
  enonce: string;
  assertions: string[];
  reponse: string;
  level: number;
  type: 'QCM' | 'VRAI_FAUX';
}>) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const docs = quizzes.map(q => ({
      ...q,
      level: q.level as 0 | 1 | 2 | 3,
      status: true,
      assets: '',
    }));
    const inserted = await Quiz.insertMany(docs, { ordered: false });
    return { success: true, count: inserted.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateQuizAction(id: string, data: {
  enonce?: string;
  assertions?: string[];
  reponse?: string;
  level?: 0 | 1 | 2 | 3;
  type?: 'QCM' | 'VRAI_FAUX';
  assets?: string;
  status?: boolean;
}) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    const quiz = await Quiz.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    if (!quiz) return { success: false, error: 'Question introuvable' };
    return { success: true, quiz: JSON.parse(JSON.stringify(quiz)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteQuizAction(id: string) {
  try {
    const session = await getSession();
    if (!session || !['ADMIN', 'MOD'].includes(session.role)) {
      return { success: false, error: 'Non autorisé' };
    }
    await connectToDb();
    await Quiz.findByIdAndDelete(id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}