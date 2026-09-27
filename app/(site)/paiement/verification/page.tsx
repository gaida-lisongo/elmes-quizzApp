import Link from "next/link";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";
import VerificationClient from "./VerificationClient";

export const metadata: Metadata = buildMetadata("Vérification de paiement");

type SearchParams = {
  type?: string;
  status?: string;
  orderNumber?: string;
  order_number?: string;
  order?: string;
  reference?: string;
};

/**
 * Page de retour de paiement (carte) et lien reçu par e-mail.
 * Elle n'applique rien à l'affichage : la vérification se fait sur un bouton (POST), et le résultat
 * ne dépend que de l'état en base et du fournisseur, jamais des paramètres de l'URL (PAY-06, PAY-22).
 */
export default async function PaymentVerificationPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const orderNumber =
    params?.orderNumber ||
    params?.order_number ||
    params?.order ||
    params?.reference ||
    "";

  return (
    <>
      <VerificationClient
        orderNumber={orderNumber}
        type={params?.type}
        status={params?.status}
      />
      <div className="-mt-16 mb-16 flex flex-wrap justify-center gap-3 px-4">
        <Link href="/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
          Retour dashboard
        </Link>
        <Link href="/dashboard?tab=retraits" className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black dark:border-strokedark dark:text-white">
          Voir mes transactions
        </Link>
      </div>
    </>
  );
}
