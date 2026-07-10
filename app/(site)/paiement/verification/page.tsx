import Link from "next/link";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { verifyPersistedPaymentAction } from "@/actions/payment.actions";
import { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";

export const metadata: Metadata = buildMetadata("Vérification de paiement");

type SearchParams = {
  type?: string;
  status?: string;
  orderNumber?: string;
  order_number?: string;
  order?: string;
  reference?: string;
  playerId?: string;
  resourceType?: string;
  resourceId?: string;
  date?: string;
};

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
    "";
  const reference = params?.reference || "";

  const result = await verifyPersistedPaymentAction({
    orderNumber,
    reference,
    playerId: params?.playerId,
    resourceType: params?.resourceType,
    resourceId: params?.resourceId,
  });

  const missingParams = !orderNumber && !reference;
  const isSuccess = result.success && result.status === "SUCCES";
  const isPending = result.success && result.status === "EN_ATTENTE";
  const isFailed = result.success && result.status === "ECHEC";
  const title = isSuccess
    ? "Paiement réussi"
    : isPending
      ? "Paiement en attente"
      : isFailed
        ? "Paiement échoué"
        : missingParams
          ? "Retour paiement incomplet"
          : "Vérification du paiement";

  const message = missingParams
    ? "Le retour FlexPay ne contient pas de numéro de commande ni de référence."
    : result.message || result.error || "Impossible de confirmer cette transaction pour le moment.";

  return (
    <section className="min-h-[70vh] bg-alabaster py-20 dark:bg-blacksection lg:py-28">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center shadow-solid-8 dark:border-strokedark dark:bg-black">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSuccess ? (
              <CheckCircle className="h-8 w-8 text-meta" />
            ) : isPending ? (
              <Clock className="h-8 w-8 text-primary" />
            ) : isFailed ? (
              <XCircle className="h-8 w-8 text-red-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-primary" />
            )}
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-black dark:text-white">{title}</h1>

          <div className="mt-4 space-y-2 text-sm text-waterloo">
            {params?.type ? <p>Source : {params.type}</p> : null}
            {params?.status ? <p>Retour FlexPay : {params.status}</p> : null}
            {params?.resourceType ? <p>Ressource : {params.resourceType}</p> : null}
            {orderNumber ? (
              <p>
                Commande : <span className="font-semibold text-primary">{orderNumber}</span>
              </p>
            ) : reference ? (
              <p>
                Reference : <span className="font-semibold text-primary">{reference}</span>
              </p>
            ) : (
              <p>Aucun numero de commande ou reference n'a ete fourni dans l'URL.</p>
            )}
          </div>

          <p className={`mt-5 text-sm ${result.success && !isFailed ? "text-black dark:text-white" : "text-red-500"}`}>
            {message}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white">
              Retour dashboard
            </Link>
            <Link href="/dashboard?tab=retraits" className="rounded-lg border border-stroke px-4 py-2 text-sm font-medium text-black dark:border-strokedark dark:text-white">
              Voir mes transactions
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
