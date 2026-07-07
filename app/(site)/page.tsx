import { Metadata } from "next";
import Hero from "@/components/Hero";
import FunFact from "@/components/FunFact";
import ParcoursSection from "@/components/Parcours";
import CompetitionsSection from "@/components/Competitions";
import PassesSection from "@/components/Passes";
import { getSession } from "@/lib/utils/auth";
import connectToDb from "@/lib/utils/db";
import Categorie from "@/lib/models/Categorie";
import Quiz from "@/lib/models/Quiz";
import Partie from "@/lib/models/Partie";

export const metadata: Metadata = {
  title: "ELMES-QUIZ | Le savoir devient un pouvoir",
  description: "Plateforme de quiz et compétition intellectuelle"
};

export default async function Home() {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN" || session?.role === "MOD";

  await connectToDb();
  const [categories, quizzes, parties] = await Promise.all([
    Categorie.countDocuments({ status: true }),
    Quiz.countDocuments({ status: true }),
    Partie.countDocuments({ status: 'TERMINE' }),
  ]);

  return (
    <main>
      <Hero />
      <FunFact categories={categories} quizzes={quizzes} parties={parties} />
      <ParcoursSection isAdmin={isAdmin} />
      <PassesSection />
      <CompetitionsSection isAdmin={isAdmin} />
    </main>
  );
}
