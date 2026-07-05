'use server';

import connectToDb from "@/lib/utils/db";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";
import Partie from "@/lib/models/Partie";

export async function getMetricsCounts() {
  try {
    await connectToDb();

    const [categoriesCount, quizzesCount, partiesCount] = await Promise.all([
      Categorie.countDocuments({ status: true }),
      Quiz.countDocuments({ status: true }),
      Partie.countDocuments({ status: 'TERMINE' }),
    ]);

    return {
      categories: categoriesCount,
      quizzes: quizzesCount,
      parties: partiesCount,
    };
  } catch (error) {
    console.error('Erreur lors du chargement des métriques:', error);
    return { categories: 0, quizzes: 0, parties: 0 };
  }
}