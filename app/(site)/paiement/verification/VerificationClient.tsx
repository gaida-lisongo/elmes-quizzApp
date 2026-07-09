"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { verifyRechargeByOrderNumberAction } from "@/actions/payment.actions";

type VerificationResult = {
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
};

export default function VerificationClient({
  orderNumber,
  type,
  status,
}: {
  orderNumber: string;
  type?: string;
  status?: string;
}) {
  const [loading, setLoading] = useState(Boolean(orderNumber));
  const [result, setResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    if (!orderNumber) return;

    verifyRechargeByOrderNumberAction(orderNumber)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [orderNumber]);

  const isSuccess = result?.success && result.status === "SUCCES";
  const isPending = result?.success && result.status === "EN_ATTENTE";
  const title = loading
    ? "Verification en cours"
    : isSuccess
      ? "Paiement valide"
      : isPending
        ? "Paiement en attente"
        : "Verification du paiement";

  return (
    <section className="min-h-[70vh] bg-alabaster py-20 dark:bg-blacksection lg:py-28">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center shadow-solid-8 dark:border-strokedark dark:bg-black">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle className="h-8 w-8 text-meta" />
            ) : (
              <AlertCircle className="h-8 w-8 text-primary" />
            )}
          </div>

          <h1 className="mt-5 text-2xl font-semibold text-black dark:text-white">{title}</h1>

          <div className="mt-4 space-y-2 text-sm text-waterloo">
            {type ? <p>Source : {type}</p> : null}
            {status ? <p>Retour FlexPay : {status}</p> : null}
            {orderNumber ? (
              <p>
                Commande : <span className="font-semibold text-primary">{orderNumber}</span>
              </p>
            ) : (
              <p>Aucun numero de commande n'a ete fourni dans l'URL.</p>
            )}
          </div>

          {result ? (
            <p className={`mt-5 text-sm ${result.success ? "text-black dark:text-white" : "text-red-500"}`}>
              {result.message || result.error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
