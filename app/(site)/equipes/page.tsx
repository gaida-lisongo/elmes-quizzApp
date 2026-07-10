import { getEquipesAction } from "@/actions/equipe.actions";
import EquipesPageClient from "@/components/Equipes/EquipePage";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";

export const metadata: Metadata = buildMetadata("Équipes");

export default async function EquipesPage() {
  try {
    const result = await getEquipesAction();

    return <EquipesPageClient equipes={result.success ? result.equipes || [] : []} />;
  } catch (error) {
    console.error("Error in EquipesPage:", error);
    return (
      <main>
        <p>Une erreur est survenue lors du chargement de la page. Veuillez réessayer plus tard.</p>
      </main>
    );
  }
}
