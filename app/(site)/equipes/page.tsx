import { Metadata } from "next";
import { getSession } from "@/lib/utils/auth";
import GamingPage from "@/components/Gaming";

export const metadata: Metadata = {
  title: "ELMES-QUIZ | Le savoir devient un pouvoir",

  // other metadata
  description: "Plateforme de quiz et compétition intellectuelle"
};

export default async function EquipesPage() {
  try{
    const session = await getSession();
    const isAdmin = session?.role === "ADMIN" || session?.role === "MOD";

    return (
      <main>
        <GamingPage />
      </main>
    );

  } catch (error) {
    console.error("Error in EquipesPage:", error);
    return (
      <main>
        <p>Une erreur est survenue lors du chargement de la page. Veuillez réessayer plus tard.</p>
      </main>
    );
  }
}
