import { AlertCircle, CheckCircle } from "lucide-react";
import { verifyPersistedPaymentAction } from "@/actions/payment.actions";

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

  const isSuccess = result.success && result.status === "SUCCES";
  const isPending = result.success && result.status === "EN_ATTENTE";
  const title = isSuccess
    ? "Paiement valide"
    : isPending
      ? "Paiement en attente"
      : "Verification du paiement";

  return (
    <section className="min-h-[70vh] bg-alabaster py-20 dark:bg-blacksection lg:py-28">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center shadow-solid-8 dark:border-strokedark dark:bg-black">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSuccess ? (
              <CheckCircle className="h-8 w-8 text-meta" />
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

          <p className={`mt-5 text-sm ${result.success ? "text-black dark:text-white" : "text-red-500"}`}>
            {result.message || result.error}
          </p>
        </div>
      </div>
    </section>
  );
}
