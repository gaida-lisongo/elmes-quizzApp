"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Mail, DollarSign, CreditCard, Loader2, AlertCircle, CheckCircle, User, ChevronRight, ArrowLeft } from "lucide-react";
import {
  findPlayerByContact,
  initiatePaymentAction,
  checkPaymentStatusAction,
} from "@/actions/payment.actions";

export type ProductInfo = {
  id: string;
  name: string;
  amountCDF: number;
  amountUSD?: number;
  type: "TRAINING_PASS" | "COMPETITION" | "EQUIPE";
  metadata?: Record<string, any>;
};

type Step = "step1_coords" | "step2_confirm" | "step3_checkout" | "processing" | "verifying" | "success" | "error";

interface PaymentDrawerProps {
  product: ProductInfo;
  onClose: () => void;
  onSuccess: (data: { orderNumber: string; product: ProductInfo }) => void;
}

const TAUX = Number(process.env.NEXT_PUBLIC_TAUX) || 2850;

const PaymentDrawer = ({ product, onClose, onSuccess }: PaymentDrawerProps) => {
  const [step, setStep] = useState<Step>("step1_coords");
  const [currency, setCurrency] = useState<"CDF" | "USD">("CDF");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [playerData, setPlayerData] = useState<any>(null);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cardMode, setCardMode] = useState(false);
  const [finding, setFinding] = useState(false);

  const amountToPay = currency === "USD"
    ? (product.amountUSD || Math.round(product.amountCDF / TAUX))
    : product.amountCDF;

  /* ── Étape 1 → 2 : Chercher le joueur ── */
  const handleFindPlayer = async () => {
    if (!phone) return;
    setFinding(true);
    setErrorMsg("");
    const res = await findPlayerByContact(phone, email || undefined);
    if (res.success && res.player) {
      setPlayerData(res.player);
      setStep("step2_confirm");
    } else {
      setErrorMsg(res.error || "Joueur introuvable.");
    }
    setFinding(false);
  };

  /* ── Étape 2 → 3 : Confirmer et passer au paiement ── */
  const handleConfirmPlayer = () => {
    setStep("step3_checkout");
  };

  /* ── Étape 3 → processing/verifying : Initier le paiement ── */
  const handlePay = async () => {
    setStep("processing");
    setErrorMsg("");

    const res = await initiatePaymentAction(
      playerData.playerId,
      phone,
      amountToPay,
      currency,
      product,
    );

    if (!res.success || !res.orderNumber) {
      setStep("error");
      setErrorMsg(res.error || "Échec de l'initiation du paiement.");
      return;
    }

    setOrderNumber(res.orderNumber);
    setStep("verifying");

    // Attendre 5 secondes puis vérifier
    await new Promise((r) => setTimeout(r, 5000));

    const statusCheck = await checkPaymentStatusAction(res.orderNumber);
    if (statusCheck.success && statusCheck.status === "SUCCES") {
      setStep("success");
      setTimeout(() => onSuccess({ orderNumber: res.orderNumber!, product }), 1500);
    } else if (statusCheck.status === "EN_ATTENTE") {
      setStep("verifying");
    } else {
      setStep("error");
      setErrorMsg(statusCheck.error || "Le paiement a échoué.");
    }
  };

  const retryCheck = async () => {
    if (!orderNumber) return;
    setStep("verifying");
    const statusCheck = await checkPaymentStatusAction(orderNumber);
    if (statusCheck.success && statusCheck.status === "SUCCES") {
      setStep("success");
      setTimeout(() => onSuccess({ orderNumber, product }), 1500);
    } else {
      setStep("error");
      setErrorMsg("Toujours pas confirmé. Vérifie ton téléphone et réessaie.");
    }
  };

  /* ── Stepper visuel ── */
  const stepper = () => {
    const steps = [
      { key: "step1_coords", num: 1, label: "Coordonnées" },
      { key: "step2_confirm", num: 2, label: "Confirmation" },
      { key: "step3_checkout", num: 3, label: "Paiement" },
    ];
    const currentIdx = steps.findIndex((s) => s.key === step);
    return (
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= currentIdx && !["processing", "verifying", "success", "error"].includes(step)
                  ? "bg-primary text-white"
                  : i <= currentIdx
                  ? "bg-meta text-white"
                  : "bg-stroke text-manatee dark:bg-strokedark"
              }`}
            >
              {s.num}
            </div>
            {i < 2 && (
              <div
                className={`h-0.5 flex-1 ${i < currentIdx ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">Paiement</h3>
              <p className="text-xs text-waterloo">{product.name}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6">
            {/* Résumé produit */}
            <div className="mb-4 rounded-lg bg-alabaster p-4 dark:bg-strokedark">
              <p className="text-xs text-waterloo">Produit</p>
              <p className="font-semibold text-black dark:text-white">{product.name}</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {product.amountCDF.toLocaleString()} FC
                {product.amountUSD && <span className="ml-2 text-sm font-normal text-waterloo">/${product.amountUSD}</span>}
              </p>
            </div>

            {/* Stepper */}
            {["step1_coords", "step2_confirm", "step3_checkout"].includes(step) && stepper()}

            <AnimatePresence mode="wait">
              {/* ══════ ÉTAPE 1 : Coordonnées ══════ */}
              {step === "step1_coords" && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <h4 className="font-medium text-black dark:text-white">
                    📋 Tes coordonnées
                  </h4>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Numéro de téléphone <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="243XXXXXXXXX"
                        className="w-full rounded-lg border border-stroke bg-transparent py-3 pl-10 pr-4 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemple@email.com"
                        className="w-full rounded-lg border border-stroke bg-transparent py-3 pl-10 pr-4 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                      />
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-red-500">{errorMsg}</p>
                  )}

                  <button
                    onClick={handleFindPlayer}
                    disabled={!phone || finding}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {finding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {finding ? "Recherche..." : "Continuer"}
                  </button>
                </motion.div>
              )}

              {/* ══════ ÉTAPE 2 : Confirmation ══════ */}
              {step === "step2_confirm" && playerData && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <h4 className="font-medium text-black dark:text-white">
                    ✅ Confirme ton profil
                  </h4>

                  <div className="rounded-lg border border-stroke bg-alabaster p-5 dark:border-strokedark dark:bg-strokedark">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-black dark:text-white">{playerData.pseudo}</p>
                        <p className="text-xs text-waterloo">{playerData.telephone}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-md bg-white p-3 dark:bg-blacksection">
                        <p className="text-waterloo">Solde</p>
                        <p className="font-bold text-black dark:text-white">
                          {playerData.solde.toLocaleString()} FC
                        </p>
                      </div>
                      <div className="rounded-md bg-white p-3 dark:bg-blacksection">
                        <p className="text-waterloo">Parties</p>
                        <p className="font-bold text-black dark:text-white">{playerData.parties}</p>
                      </div>
                      <div className="rounded-md bg-white p-3 dark:bg-blacksection">
                        <p className="text-waterloo">Niveau</p>
                        <p className="font-bold text-primary">{playerData.level}</p>
                      </div>
                      <div className="rounded-md bg-white p-3 dark:bg-blacksection">
                        <p className="text-waterloo">Type</p>
                        <p className="font-bold text-black dark:text-white">{playerData.type}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("step1_coords")}
                      className="flex items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    >
                      <ArrowLeft className="h-4 w-4" /> Modifier
                    </button>
                    <button
                      onClick={handleConfirmPlayer}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-white transition hover:bg-primaryho"
                    >
                      C&apos;est bien moi <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ══════ ÉTAPE 3 : Checkout ══════ */}
              {step === "step3_checkout" && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <h4 className="font-medium text-black dark:text-white">
                    💳 Checkout
                  </h4>

                  {/* Sélection devise */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Monnaie</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setCurrency("CDF"); setCardMode(false); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                          currency === "CDF" && !cardMode
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                        }`}
                      >
                        <DollarSign className="h-4 w-4" /> FC
                      </button>
                      <button
                        onClick={() => { setCurrency("USD"); setCardMode(false); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                          currency === "USD" && !cardMode
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                        }`}
                      >
                        <DollarSign className="h-4 w-4" /> USD
                      </button>
                      <button
                        onClick={() => { setCardMode(true); setCurrency("USD"); }}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                          cardMode
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                        }`}
                      >
                        <CreditCard className="h-4 w-4" /> Carte
                      </button>
                    </div>
                  </div>

                  {/* Résumé */}
                  <div className="rounded-lg border border-stroke p-4 dark:border-strokedark">
                    <div className="flex justify-between text-sm">
                      <span className="text-waterloo">Montant</span>
                      <span className="font-bold text-black dark:text-white">
                        {currency === "CDF"
                          ? `${amountToPay.toLocaleString()} FC`
                          : `$${amountToPay}`}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-waterloo">Joueur</span>
                      <span className="text-black dark:text-white">{playerData.pseudo}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-waterloo">Téléphone</span>
                      <span className="text-black dark:text-white">{phone}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep("step2_confirm")}
                      className="flex items-center gap-2 rounded-full border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    >
                      <ArrowLeft className="h-4 w-4" /> Retour
                    </button>
                    <button
                      onClick={handlePay}
                      disabled={cardMode}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-medium text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CreditCard className="h-4 w-4" />
                      Payer {currency === "CDF" ? `${amountToPay.toLocaleString()} FC` : `$${amountToPay}`}
                    </button>
                  </div>
                  {cardMode && (
                    <p className="text-xs text-yellow-600">Le paiement par carte sera bientôt disponible.</p>
                  )}
                </motion.div>
              )}

              {/* ══════ PROCESSING / VERIFYING ══════ */}
              {(step === "processing" || step === "verifying") && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                  <h4 className="mb-2 text-lg font-semibold text-black dark:text-white">
                    {step === "processing" ? "Initiation du paiement..." : "Vérification en cours..."}
                  </h4>
                  <p className="text-sm text-waterloo">
                    {step === "processing"
                      ? "Veuillez confirmer l'opération sur votre téléphone."
                      : "Nous vérifions le statut de la transaction."}
                  </p>
                  {orderNumber && (
                    <p className="mt-3 text-xs text-waterloo">Réf: {orderNumber.slice(0, 16)}...</p>
                  )}
                  {step === "verifying" && (
                    <button
                      onClick={retryCheck}
                      className="mt-6 rounded-full bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho"
                    >
                      Vérifier à nouveau
                    </button>
                  )}
                </motion.div>
              )}

              {/* ══════ SUCCESS ══════ */}
              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <CheckCircle className="mb-4 h-16 w-16 text-green-500" />
                  <h4 className="mb-2 text-lg font-semibold text-green-600">Paiement réussi !</h4>
                  <p className="text-sm text-waterloo">
                    Votre {product.type === "TRAINING_PASS" ? "pass" : "inscription"} a été activé.
                  </p>
                  <button
                    onClick={onClose}
                    className="mt-6 rounded-full bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho"
                  >
                    Fermer
                  </button>
                </motion.div>
              )}

              {/* ══════ ERROR ══════ */}
              {step === "error" && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center py-12 text-center"
                >
                  <AlertCircle className="mb-4 h-16 w-16 text-red-500" />
                  <h4 className="mb-2 text-lg font-semibold text-red-600">Paiement échoué</h4>
                  <p className="text-sm text-waterloo">{errorMsg || "Une erreur est survenue."}</p>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setStep("step3_checkout")}
                      className="rounded-full border border-stroke px-6 py-2 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    >
                      Réessayer
                    </button>
                    <button
                      onClick={onClose}
                      className="rounded-full bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho"
                    >
                      Annuler
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PaymentDrawer;