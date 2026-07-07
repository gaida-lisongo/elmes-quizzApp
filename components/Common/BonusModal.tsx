"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Sparkles, X, Loader2, CheckCircle } from "lucide-react";
import { applyWeeklyBonusAction, applyBonusPartiesAction } from "@/actions/critere.actions";
import { getCurrentUserDetailed } from "@/actions/auth.actions";
import toast from "react-hot-toast";

interface BonusModalProps {
  open: boolean;
  onClose: () => void;
  playerId?: string;
  isAdmin?: boolean;
}

export default function BonusModal({ open, onClose, playerId, isAdmin }: BonusModalProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [manualPlayerId, setManualPlayerId] = useState("");
  const [bonusCount, setBonusCount] = useState(3);

  useEffect(() => {
    if (open && !isAdmin) {
      getCurrentUserDetailed().then(setUser).catch(() => {});
      // Vérifier si déjà fait cette semaine (stocké localStorage)
      const lastBonus = localStorage.getItem("last_weekly_bonus");
      if (lastBonus) {
        const today = new Date().toISOString().slice(0, 10);
        if (lastBonus === today) setDone(true);
      }
    }
  }, [open, isAdmin]);

  const handleWeekly = async () => {
    setLoading(true);
    try {
      const res = await applyWeeklyBonusAction();
      if (res.success) {
        localStorage.setItem("last_weekly_bonus", new Date().toISOString().slice(0, 10));
        setDone(true);
        toast.success(res.message || "Bonus hebdomadaire appliqué !");
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  const handleManual = async () => {
    const targetId = playerId || manualPlayerId;
    if (!targetId) return toast.error("ID du joueur requis");
    setLoading(true);
    try {
      const res = await applyBonusPartiesAction(targetId, bonusCount);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-md rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/10">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">Bonus & récompenses</h3>
                  <p className="text-xs text-waterloo">
                    {isAdmin ? "Attribuer un bonus manuellement" : "Réclamer votre bonus"}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark">
                <X className="h-5 w-5" />
              </button>
            </div>

            {!isAdmin && !done && (
              <div className="mb-4 rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                <p className="text-sm font-medium text-black dark:text-white">Bonus hebdomadaire disponible</p>
                <p className="mt-1 text-xs text-waterloo">
                  {user?.profile?.type === "STANDALONE"
                    ? "+20 parties dans votre solde"
                    : "+30 parties max dans vos enrollements"}
                </p>
                <button
                  onClick={handleWeekly}
                  disabled={loading}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primaryho disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Réclamer mon bonus
                </button>
              </div>
            )}

            {!isAdmin && done && (
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-5 w-5 shrink-0" />
                Bonus déjà réclamé cette semaine
              </div>
            )}

            {isAdmin && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-black dark:text-white">ID du joueur</label>
                  <input
                    type="text"
                    value={manualPlayerId}
                    onChange={(e) => setManualPlayerId(e.target.value)}
                    placeholder={playerId || "ID Player..."}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm dark:border-strokedark dark:text-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-black dark:text-white">Incrément :</label>
                  {[3, 6, 9, 12, 15].map((n) => (
                    <button
                      key={n}
                      onClick={() => setBonusCount(n)}
                      className={`rounded-lg border px-3 py-1 text-sm ${
                        bonusCount === n
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-stroke text-waterloo dark:border-strokedark"
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleManual}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primaryho disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Ajouter {bonusCount} partie(s)
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}