'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, CheckCircle, AlertCircle, Calendar, User, Users, Target, ChevronRight, ArrowLeft, DollarSign, CreditCard } from "lucide-react";
import { getSessionsByRessourceAction, enrollToParcoursAction, enrollToCompetitionAction, confirmCompetitionEnrollmentPaymentAction } from "@/actions/enrollment.actions";
import { verifyPersistedPaymentAction } from "@/actions/payment.actions";
import type { EnrollmentInfo } from "./index";

interface ISessionItem {
  _id: string;
  slug: string;
  designation: string;
  startDate: string;
  endDate: string;
  enrollmentFeeCDF?: number;
}

interface DrawerInscriptionProps {
  open: boolean;
  onClose: () => void;
  type: "parcours" | "competition";
  targetId: string;
  targetName: string;
  enrollmentInfo: EnrollmentInfo;
  amount: number
}

type Step = "sessions" | "confirm" | "payment" | "processing" | "success" | "error";

const TAUX = Number(process.env.NEXT_PUBLIC_TAUX) || 2850;
const DEFAULT_PARCOURS_ENROLLMENT_FEE_CDF = 15000;

export default function DrawerInscription({
  open,
  onClose,
  type,
  targetId,
  targetName,
  enrollmentInfo,
  amount
}: DrawerInscriptionProps) {
  const [sessions, setSessions] = useState<ISessionItem[]>([]);
  const [selectedSession, setSelectedSession] = useState<ISessionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("sessions");
  const [errorMsg, setErrorMsg] = useState("");
  const [phone, setPhone] = useState(enrollmentInfo.telephone || "");
  const [email, setEmail] = useState(enrollmentInfo.email || "");
  const [currency, setCurrency] = useState<"USD" | "CDF">("USD");
  const [paymentMethod, setPaymentMethod] = useState<"MOBILE_MONEY" | "CARD">("MOBILE_MONEY");
  const [orderNumber, setOrderNumber] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [uniqueCode, setUniqueCode] = useState("");

  // Charger les sessions disponibles
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setStep("sessions");
    setSelectedSession(null);
    setErrorMsg("");

    setPhone(enrollmentInfo.telephone || "");
    setEmail(enrollmentInfo.email || "");
    setOrderNumber("");
    setEnrollmentId("");
    setUniqueCode("");
    setPaymentMethod("MOBILE_MONEY");

    getSessionsByRessourceAction(type === "parcours" ? "Parcours" : "Competition", targetId, true)
      .then((res) => {
        if (res.success && res.sessions) {
          setSessions(res.sessions);
        } else {
          setErrorMsg(res.error || "Impossible de charger les sessions");
        }
      })
      .catch(() => setErrorMsg("Erreur lors du chargement des sessions"))
      .finally(() => setLoading(false));
  }, [open, type, targetId, enrollmentInfo.telephone, enrollmentInfo.email]);

  // Vérifier les prérequis (déjà validés côté serveur, mais double-check)
  const canEnroll = () => {
    if (type === "parcours" && enrollmentInfo.type !== 'player') {
      setErrorMsg("Profil joueur requis pour s'inscrire à un parcours");
      return false;
    }
    if (type === "competition" && enrollmentInfo.type !== 'equipe') {
      setErrorMsg("Équipe requise pour s'inscrire à une compétition");
      return false;
    }
    return true;
  };

  const handleSelectSession = (session: ISessionItem) => {
    if (!canEnroll()) return;
    setSelectedSession(session);
    setStep("payment");
  };

  const getEnrollmentAmountCDF = () => {
    const configuredAmount = Number(selectedSession?.enrollmentFeeCDF || amount || 0);
    if (configuredAmount > 0) return configuredAmount;
    return type === "parcours" ? DEFAULT_PARCOURS_ENROLLMENT_FEE_CDF : 0;
  };

  const handleConfirm = async () => {
    if (!selectedSession) return;
    setStep("confirm");
  };

  const handlePayEnrollment = async () => {
    if (!selectedSession) return;
    if (!phone.trim()) {
      setErrorMsg("Le numero Mobile Money est requis.");
      return;
    }
    const enrollmentAmountCDF = getEnrollmentAmountCDF();
    if (enrollmentAmountCDF <= 0) {
      setErrorMsg("Montant d'enrolement indisponible.");
      return;
    }

    setStep("processing");
    setErrorMsg("");

    const amountConvert = currency === "CDF" ? enrollmentAmountCDF : (enrollmentAmountCDF / TAUX);
    const payload = {
      phone,
      email,
      currency,
      amount: amountConvert,
      method: paymentMethod,
    };
    const res = type === "parcours"
      ? await enrollToParcoursAction(targetId, selectedSession._id, payload)
      : await enrollToCompetitionAction(targetId, selectedSession._id, payload);

    if (!res.success || !res.enrollment || !res.orderNumber) {
      setErrorMsg(res.error || "Echec de l'initiation du paiement");
      setStep("error");
      return;
    }

    setEnrollmentId(res.enrollment._id);
    setUniqueCode(res.enrollment.code || "");
    setOrderNumber(res.orderNumber);
    if (paymentMethod === "CARD" && res.redirectUrl) {
      window.location.href = res.redirectUrl;
      return;
    }
    setStep("confirm");
  };
  const handleConfirmPayment = async () => {
    if (!enrollmentId || !orderNumber) return;

    setStep("processing");
    setErrorMsg("");

    const res = type === "parcours"
      ? await verifyPersistedPaymentAction({ orderNumber, resourceType: "PARCOURS" })
      : await confirmCompetitionEnrollmentPaymentAction(enrollmentId, orderNumber, email);
    if (!res.success || (type === "parcours" && (res as any).status !== "SUCCES")) {
      setErrorMsg(res.error || "Le paiement n'est pas encore confirme.");
      setStep("payment");
      return;
    }

    if ((res as any).code) setUniqueCode((res as any).code || "");
    setStep("success");
  };

  // Formater une date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm"
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
              <div className="flex items-center gap-3">
                {type === "parcours" ? (
                  <Target className="h-6 w-6 text-primary" />
                ) : (
                  <Users className="h-6 w-6 text-primary" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">
                    {type === "parcours" ? "Inscription au parcours" : "Inscription à la compétition"}
                  </h3>
                  <p className="text-xs text-waterloo truncate max-w-[200px]">{targetName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Stepper */}
              {["sessions", "confirm", "payment"].includes(step) && (
                <div className="mb-6 flex items-center gap-2">
                  {[
                    { key: "sessions", num: 1, label: "Session" },
                    { key: "payment", num: 2, label: "Paiement" },
                    { key: "confirm", num: 3, label: "Confirmation" },
                  ].map((s, i, steps) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          step === s.key
                            ? "bg-primary text-white"
                            : "bg-stroke text-manatee dark:bg-strokedark"
                        }`}
                      >
                        {s.num}
                      </div>
                      {i < steps.length - 1 && (
                        <div
                          className={`h-0.5 w-8 ${
                            steps.findIndex((item) => item.key === step) > i
                              ? "bg-meta"
                              : "bg-stroke dark:bg-strokedark"
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* Étape 1 : Choix de la session */}
                {step === "sessions" && (
                  <motion.div
                    key="sessions"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-waterloo">
                      <Calendar className="h-4 w-4" />
                      <h4 className="font-medium text-black dark:text-white">
                        Choisissez une session
                      </h4>
                    </div>

                    {loading ? (
                      <div className="flex flex-col items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-3 text-sm text-waterloo">
                          Chargement des sessions...
                        </p>
                      </div>
                    ) : errorMsg ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                        {errorMsg}
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <Calendar className="h-10 w-10 text-waterloo/40" />
                        <p className="mt-3 font-medium text-black dark:text-white">
                          Aucune session disponible
                        </p>
                        <p className="mt-1 text-sm text-waterloo">
                          Revenez plus tard pour découvrir les prochaines sessions.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sessions.map((session) => (
                          <motion.button
                            key={session._id}
                            whileHover={{ scale: 1.01 }}
                            onClick={() => handleSelectSession(session)}
                            className="w-full rounded-xl border border-stroke bg-alabaster p-4 text-left transition hover:border-primary dark:border-strokedark dark:bg-strokedark dark:hover:border-primary"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-semibold text-black dark:text-white">
                                  {session.designation}
                                </p>
                                <div className="mt-2 flex items-center gap-4 text-xs text-waterloo">
                                  <span>
                                    Du {formatDate(session.startDate)}
                                  </span>
                                  <span>au {formatDate(session.endDate)}</span>
                                </div>
                              </div>
                              <ChevronRight className="ml-2 mt-1 h-5 w-5 text-waterloo" />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Étape 2 : Confirmation */}
                {step === "confirm" && selectedSession && (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center gap-2 text-waterloo">
                      <CheckCircle className="h-4 w-4" />
                      <h4 className="font-medium text-black dark:text-white">
                        Confirmation du paiement
                      </h4>
                    </div>

                    {/* Récapitulatif */}
                    <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">{type === "parcours" ? "Parcours" : "Compétition"}</span>
                          <span className="font-medium text-black dark:text-white">{targetName}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">Session</span>
                          <span className="font-medium text-black dark:text-white">
                            {selectedSession.designation}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">Commande</span>
                          <span className="font-medium text-primary">{orderNumber || "-"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">Début</span>
                          <span className="font-medium text-black dark:text-white">
                            {formatDate(selectedSession.startDate)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">Fin</span>
                          <span className="font-medium text-black dark:text-white">
                            {formatDate(selectedSession.endDate)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-waterloo">{enrollmentInfo.type === 'equipe' ? "Équipe" : "Profil"}</span>
                          <span className="font-medium text-primary">
                            {enrollmentInfo.type === 'equipe' ? enrollmentInfo.designation : enrollmentInfo.pseudo}
                          </span>
                        </div>
                      </div>
                    </div>

                    {errorMsg && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                        {errorMsg}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setStep("payment");
                          setErrorMsg("");
                        }}
                        className="flex items-center gap-2 rounded-xl border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                      >
                        <ArrowLeft className="h-4 w-4" /> Retour
                      </button>
                      <button
                        onClick={handleConfirmPayment}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primaryho"
                      >
                        Vérifier le paiement <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "payment" && selectedSession && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center gap-2 text-waterloo">
                      <DollarSign className="h-4 w-4" />
                      <h4 className="font-medium text-black dark:text-white">Paiement de l'enrollement</h4>
                    </div>

                    <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                      <div className="flex justify-between text-sm">
                        <span className="text-waterloo">Montant</span>
                        <span className="font-bold text-primary">{getEnrollmentAmountCDF().toLocaleString("fr-FR")} CDF</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-waterloo">{enrollmentInfo.type === "equipe" ? "Equipe" : "Profil"}</span>
                        <span className="font-medium text-black dark:text-white">{enrollmentInfo.type === "equipe" ? enrollmentInfo.designation : enrollmentInfo.pseudo}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-waterloo">Session</span>
                        <span className="font-medium text-black dark:text-white">{selectedSession.designation}</span>
                      </div>
                      {orderNumber && (
                        <div className="mt-2 flex justify-between text-sm">
                          <span className="text-waterloo">Commande</span>
                          <span className="font-medium text-primary">{orderNumber}</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">Monnaie</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["USD", "CDF"] as const).map((item) => (
                          <button
                            key={item}
                            onClick={() => setCurrency(item)}
                            className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                              currency === item
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                            }`}
                          >
                            {item === "CDF" ? `${getEnrollmentAmountCDF().toLocaleString("fr-FR")} CDF` : `${(getEnrollmentAmountCDF() / TAUX).toFixed()} USD`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-black dark:text-white">Mode de paiement</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Mobile Money", value: "MOBILE_MONEY" as const, icon: DollarSign },
                          { label: "Carte bancaire", value: "CARD" as const, icon: CreditCard },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setPaymentMethod(item.value)}
                              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                                paymentMethod === item.value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Téléphone Mobile Money</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="243XXXXXXXXX"
                        className="w-full rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-black outline-hidden transition focus:border-primary dark:border-strokedark dark:bg-black dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Email de réception</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="prenom.nom@email.com"
                        className="w-full rounded-lg border border-stroke bg-white px-4 py-2.5 text-sm text-black outline-hidden transition focus:border-primary dark:border-strokedark dark:bg-black dark:text-white"
                      />
                    </div>

                    {errorMsg && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
                        {errorMsg}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setStep("sessions");
                          setErrorMsg("");
                        }}
                        className="flex items-center gap-2 rounded-xl border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                      >
                        <ArrowLeft className="h-4 w-4" /> Retour
                      </button>
                      <button
                        onClick={handlePayEnrollment}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-white transition hover:bg-primaryho"
                      >
                        Payer <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Processing */}
                {step === "processing" && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center py-12"
                  >
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 font-medium text-black dark:text-white">
                      Inscription en cours...
                    </p>
                    <p className="mt-1 text-sm text-waterloo">
                      Veuillez patienter pendant le traitement.
                    </p>
                  </motion.div>
                )}

                {/* Success */}
                {step === "success" && (
                  <motion.div
                    key="success"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center py-12 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h4 className="mt-4 text-xl font-bold text-black dark:text-white">
                      Inscription réussie !
                    </h4>
                    <p className="mt-2 text-sm text-waterloo">
                      Vous êtes maintenant inscrit{type === "parcours" ? " à ce parcours" : "e à cette compétition"}.
                    </p>
                    {uniqueCode && (
                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                        <p className="text-xs text-waterloo">Code unique</p>
                        <p className="mt-1 break-all font-mono text-sm font-semibold text-primary">{uniqueCode}</p>
                      </div>
                    )}
                    <button
                      onClick={onClose}
                      className="mt-6 rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primaryho"
                    >
                      Fermer
                    </button>
                  </motion.div>
                )}

                {/* Error */}
                {step === "error" && (
                  <motion.div
                    key="error"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center py-12 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h4 className="mt-4 text-xl font-bold text-black dark:text-white">
                      Échec de l'inscription
                    </h4>
                    <p className="mt-2 text-sm text-red-500">{errorMsg}</p>
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => {
                          setStep("sessions");
                          setErrorMsg("");
                        }}
                        className="rounded-xl border border-stroke px-6 py-3 text-sm text-black transition hover:bg-stroke dark:text-white dark:hover:bg-strokedark"
                      >
                        Réessayer
                      </button>
                      <button
                        onClick={onClose}
                        className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primaryho"
                      >
                        Fermer
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



