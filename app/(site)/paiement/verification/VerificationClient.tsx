"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { verifyPaymentByOrderNumberAction } from "@/actions/payment.actions";

type VerificationResult = {
  success: boolean;
  status?: string;
  message?: string;
  error?: string;
};

/**
 * La vérification est déclenchée par un bouton (requête POST), jamais au simple affichage de la page.
 */
export default function VerificationClient({
  orderNumber,
  type,
  status,
}: {
  orderNumber: string;
  type?: string;
  status?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!orderNumber) return;
    setLoading(true);
    try {
      setResult(await verifyPaymentByOrderNumberAction(orderNumber));
    } catch {
      setResult({ success: false, error: "Vérification impossible pour le moment." });
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = result?.success && result.status === "SUCCES";
  const isPending = result?.success && (result.status === "EN_ATTENTE" || result.status === "A_VERIFIER");
  const isFailed = result?.success && result.status === "ECHEC";
  const title = loading
    ? "Vérification en cours"
    : isSuccess
      ? "Paiement réussi"
      : isPending
        ? "Paiement en attente"
        : isFailed
          ? "Paiement échoué"
          : !orderNumber
            ? "Retour paiement incomplet"
            : "Vérification du paiement";

  return (
    <section className="min-h-[70vh] bg-alabaster py-20 dark:bg-blacksection lg:py-28">
      <div className="mx-auto max-w-2xl px-4 md:px-8">
        <div className="rounded-2xl border border-stroke bg-white p-6 text-center shadow-solid-8 dark:border-strokedark dark:bg-black">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isSuccess ? (
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
            {type ? <p>Source : {type}</p> : null}
            {status ? <p>Retour du fournisseur : {status}</p> : null}
            {orderNumber ? (
              <p>
                Commande : <span className="font-semibold text-primary">{orderNumber}</span>
              </p>
            ) : (
              <p>Aucun numéro de commande ni référence n&apos;a été fourni dans l&apos;URL.</p>
            )}
          </div>

          {result ? (
            <p className={`mt-5 text-sm ${result.success && !isFailed ? "text-black dark:text-white" : "text-red-500"}`}>
              {result.message || result.error}
            </p>
          ) : null}

          {orderNumber ? (
            <button
              type="button"
              onClick={handleVerify}
              disabled={loading}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {result ? "Vérifier à nouveau" : "Vérifier mon paiement"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
