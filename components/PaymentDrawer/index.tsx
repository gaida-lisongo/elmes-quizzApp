"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, User, Phone, DollarSign, CreditCard, Loader2,
  AlertCircle, CheckCircle, ChevronRight, ArrowLeft, Wallet,
  Users,
} from "lucide-react";
import {
  initiatePaymentAction,
} from "@/actions/payment.actions";
import SearchUserInput, { type SearchUserResult } from "@/components/Common/SearchUserInput";

export type ProductInfo = {
  id: string;
  name: string;
  amountCDF: number;
  amountUSD?: number;
  type: "TRAINING_PASS" | "COMPETITION" | "EQUIPE";
  metadata?: Record<string, any>;
};

type Step = "step1_search" | "step2_confirm" | "processing" | "success" | "error";

interface PaymentDrawerProps {
  product: ProductInfo;
  onClose: () => void;
  onSuccess: (data: { orderNumber: string; product: ProductInfo }) => void;
}

const TAUX = Number(process.env.NEXT_PUBLIC_TAUX) || 2350;

// ─── SearchUser sub-component ───────────────────────────────────────

// ─── Main PaymentDrawer ─────────────────────────────────────────────

const PaymentDrawer = ({ product, onClose, onSuccess }: PaymentDrawerProps) => {
  const [step, setStep] = useState<Step>("step1_search");
  const [currency, setCurrency] = useState<"CDF" | "USD">("CDF");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<SearchUserResult | null>(null);
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [cardMode, setCardMode] = useState(false);

  const amountToPay = currency === "USD"
    ? (product.amountUSD || Math.round(product.amountCDF / TAUX))
    : product.amountCDF;

  const handleUserSelect = (user: SearchUserResult) => {
    console.log("Selected user:", user);
    setSelectedUser(user);
    setPhone(user.telephone);
    setEmail(user.email || "");
  };

  const handleConfirmUser = () => {
    if (!selectedUser) return;
    if (!phone.trim()) { setErrorMsg("Le numéro de téléphone est requis."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) { setErrorMsg("Une adresse email valide est requise."); return; }
    setErrorMsg("");
    setStep("step2_confirm");
  };

  const handlePay = async () => {
    if (!selectedUser) return;
    setStep("processing");
    setErrorMsg("");
    const res = await initiatePaymentAction(
      selectedUser?.playerId ?? "",
      phone,
      amountToPay,
      currency,
      product,
      email.trim(),
      cardMode ? "CARD" : "MOBILE_MONEY",
    );
    if (!res.success || !res.orderNumber) { setStep("error"); setErrorMsg(res.error || "Échec de l'initiation du paiement."); return; }
    setOrderNumber(res.orderNumber);
    if (cardMode && res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }
    setStep("success");
    setTimeout(() => onSuccess({ orderNumber: res.orderNumber!, product }), 1200);
  };

  const stepper = () => {
    const steps = [
      { key: "step1_search", num: 1, label: "Joueur" },
      { key: "step2_confirm", num: 2, label: "Paiement" },
    ];
    const currentIdx = steps.findIndex((s) => s.key === step);
    return (
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i <= currentIdx && !["processing", "verifying", "success", "error"].includes(step)
                ? "bg-primary text-white" : i <= currentIdx ? "bg-meta text-white" : "bg-stroke text-manatee dark:bg-strokedark"
            }`}>{s.num}</div>
            {i < 1 && <div className={`h-0.5 flex-1 ${i < currentIdx ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm" onClick={onClose}
      >
        <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
            <div>
              <h3 className="text-lg font-bold text-black dark:text-white">Paiement</h3>
              <p className="text-xs text-waterloo">{product.name}</p>
            </div>
            <button onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
            ><X className="h-5 w-5" /></button>
          </div>

          <div className="p-6">
            <div className="mb-4 rounded-lg bg-alabaster p-4 dark:bg-strokedark">
              <p className="text-xs text-waterloo">Produit</p>
              <p className="font-semibold text-black dark:text-white">{product.name}</p>
              <p className="mt-1 text-lg font-bold text-primary">
                {product.amountCDF.toLocaleString()} FC
                {product.amountUSD && <span className="ml-2 text-sm font-normal text-waterloo">/${product.amountUSD}</span>}
              </p>
            </div>

            {["step1_search", "step2_confirm"].includes(step) && stepper()}

            <AnimatePresence mode="wait">
              {step === "step1_search" && (
                <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="flex items-center gap-2 text-waterloo">
                    <Users className="h-4 w-4" />
                    <h4 className="font-medium text-black dark:text-white">Qui est le joueur ?</h4>
                  </div>
                  <SearchUserInput onSelect={handleUserSelect} label="Rechercher un joueur" />
                  {selectedUser && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="rounded-xl border border-primary/30 bg-primary/5 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
                          <div>
                            <p className="font-semibold text-black dark:text-white">{selectedUser.pseudo}</p>
                            <p className="text-xs text-waterloo">{selectedUser.telephone}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                          {selectedUser.playerType || selectedUser.role}
                        </span>
                      </div>
                      <div className="mb-3">
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black dark:text-white">
                          <Phone className="h-3.5 w-3.5 text-primary" /> Numéro de téléphone (Mobile Money)
                        </label>
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                          placeholder="243XXXXXXXXX"
                          className="w-full rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-black outline-hidden transition focus:border-primary dark:border-strokedark dark:bg-black dark:text-white"
                        />
                      </div>
                      <div className="mb-3">
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-black dark:text-white">
                          <User className="h-3.5 w-3.5 text-primary" /> Email de réception
                        </label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="prenom.nom@email.com"
                          className="w-full rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-black outline-hidden transition focus:border-primary dark:border-strokedark dark:bg-black dark:text-white"
                        />
                      </div>
                      {errorMsg && <p className="mb-2 text-sm text-red-500">{errorMsg}</p>}
                      <button onClick={handleConfirmUser}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primaryho"
                      >Confirmer <ChevronRight className="h-4 w-4" /></button>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {step === "step2_confirm" && selectedUser && (
                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div className="flex items-center gap-2 text-waterloo">
                    <Wallet className="h-4 w-4" />
                    <h4 className="font-medium text-black dark:text-white">Mode de paiement</h4>
                  </div>
                  <div className="rounded-lg border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
                      <div>
                        <p className="font-semibold text-black dark:text-white">{selectedUser.pseudo}</p>
                        <p className="text-xs text-waterloo">{phone}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-black dark:text-white">Monnaie</label>
                    <div className="flex gap-2">
                      {[
                        { label: "FC", curr: "CDF" as const, card: false },
                        { label: "USD", curr: "USD" as const, card: false },
                        { label: "Carte", curr: "USD" as const, card: true },
                      ].map((opt) => (
                        <button key={opt.label} onClick={() => { setCurrency(opt.curr); setCardMode(opt.card); }}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                            (opt.card ? cardMode : currency === opt.curr && !cardMode)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                          }`}
                        >
                          {opt.card ? <CreditCard className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />} {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                    {[
                      { label: "Produit", value: product.name },
                      { label: "Montant", value: currency === "CDF" ? `${amountToPay.toLocaleString()} FC` : `$${amountToPay}`, bold: true },
                      { label: "Joueur", value: selectedUser.pseudo },
                      { label: "Téléphone", value: phone },
                    ].map((r) => (
                      <div key={r.label} className="flex justify-between text-sm mt-2 first:mt-0">
                        <span className="text-waterloo">{r.label}</span>
                        <span className={r.bold ? "font-bold text-primary" : "text-black dark:text-white"}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep("step1_search")}
                      className="flex items-center gap-2 rounded-xl border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    ><ArrowLeft className="h-4 w-4" /> Retour</button>
                    <button onClick={handlePay}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primaryho"
                    >Payer {amountToPay.toLocaleString()} {currency === "CDF" ? "FC" : "$"} <ChevronRight className="h-4 w-4" /></button>
                  </div>
                </motion.div>
              )}

              {step === "processing" && (
                <motion.div key="processing" className="flex flex-col items-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="mt-4 font-medium text-black dark:text-white">Initiation du paiement…</p>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div key="success" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center py-12"
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-meta/20">
                    <CheckCircle className="h-10 w-10 text-meta" />
                  </div>
                  <p className="mt-4 text-xl font-bold text-black dark:text-white">Paiement initié</p>
                  <p className="mt-1 text-sm text-waterloo">La transaction a été enregistrée dans votre compte.</p>
                  <p className="mt-2 text-sm text-waterloo">Veuillez valider la transaction depuis votre dashboard pour finaliser l’opération.</p>
                  <p className="mt-2 text-sm font-medium text-primary">N° commande : {orderNumber}</p>
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep("step2_confirm")}
                      className="rounded-xl border border-stroke px-6 py-2.5 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    >Refaire la transaction</button>
                    <button onClick={onClose}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm text-white hover:bg-primaryho"
                    >OK</button>
                  </div>
                </motion.div>
              )}

              {step === "error" && (
                <motion.div key="error" className="flex flex-col items-center py-12">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
                    <AlertCircle className="h-10 w-10 text-red-500" />
                  </div>
                  <p className="mt-4 font-medium text-red-500">Échec du paiement</p>
                  <p className="mt-1 text-sm text-waterloo">{errorMsg}</p>
                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep("step2_confirm")}
                      className="rounded-xl border border-stroke px-6 py-2.5 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                    >Réessayer</button>
                    <button onClick={onClose}
                      className="rounded-xl bg-primary px-6 py-2.5 text-sm text-white hover:bg-primaryho"
                    >Annuler</button>
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
