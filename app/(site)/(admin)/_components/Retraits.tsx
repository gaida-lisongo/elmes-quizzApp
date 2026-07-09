"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Loader2, RefreshCw, Clock, CheckCircle, AlertCircle, Send,
} from "lucide-react";
import {
  getMyRetraitsAction,
  checkRetraitStatusAction,
  requestRetraitAction,
  getPendingWithdrawalsAdminAction,
  validateWithdrawalAdminAction,
} from "@/actions/payment.actions";
import toast from "react-hot-toast";

const STATUS_BADGE: Record<string, string> = {
  SUCCES: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EN_ATTENTE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ECHEC: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function RetraitsTable() {
  const [data, setData] = useState<any>(null);
  const [adminWithdrawals, setAdminWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getMyRetraitsAction();
    if (res.success) {
      setData(res.data || null);
      setPhone(res.data?.telephone || "");
      if (res.data?.role && ["ADMIN", "MOD"].includes(res.data.role)) {
        const adminRes = await getPendingWithdrawalsAdminAction();
        if (adminRes.success) setAdminWithdrawals(adminRes.data || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCheck = async (index: number) => {
    setCheckingIndex(index);
    try {
      const res = await checkRetraitStatusAction(index);
      if (res.success) {
        toast.success(res.message || "Statut OK.");
        await load();
      } else {
        toast.error(res.error || "Erreur de vérification.");
      }
    } catch {
      toast.error("Erreur lors de la vérification.");
    } finally {
      setCheckingIndex(null);
    }
  };

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const res = await requestRetraitAction(phone, Number(amount));
      if (res.success) {
        toast.success(res.message || "Demande enregistrée.");
        setAmount("");
        await load();
      } else {
        toast.error(res.error || "Impossible de créer le retrait.");
      }
    } catch {
      toast.error("Erreur lors de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (playerId: string, retraitIndex: number) => {
    const key = `${playerId}-${retraitIndex}`;
    setValidating(key);
    try {
      const res = await validateWithdrawalAdminAction(playerId, retraitIndex);
      if (res.success) toast.success(res.message || "Retrait validé.");
      else toast.error(res.error || "Validation refusée.");
      await load();
    } catch {
      toast.error("Erreur lors de la validation.");
    } finally {
      setValidating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const retraits = data?.retraits || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
    >
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-black dark:text-white">Mes retraits</h2>
          {data && (
            <p className="text-xs text-waterloo">
              Solde : <span className="font-semibold text-black dark:text-white">{data.solde?.toLocaleString("fr-FR") || 0} FC</span>
            </p>
          )}
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{retraits.length} retrait(s)</span>
      </div>

      {data?.role === "PLAYER" ? (
        <div className="mb-6 rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Téléphone Mobile Money"
              className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-blacksection"
            />
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Montant"
              className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-blacksection"
            />
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Demander
            </button>
          </div>
          <p className="mt-2 text-xs text-waterloo">La demande reste en attente jusqu'à validation par un gestionnaire.</p>
        </div>
      ) : null}

      {["ADMIN", "MOD"].includes(data?.role) ? (
        <div className="mb-6 rounded-xl border border-stroke p-4 dark:border-strokedark">
          <h3 className="mb-3 font-semibold text-black dark:text-white">Retraits joueurs en attente</h3>
          {adminWithdrawals.length === 0 ? (
            <p className="text-sm text-waterloo">Aucun retrait joueur en attente.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {adminWithdrawals.map((item) => {
                const key = `${item.playerId}-${item.retraitIndex}`;
                return (
                  <div key={key} className="rounded-lg border border-stroke p-3 text-sm dark:border-strokedark">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-black dark:text-white">{item.pseudo}</p>
                        <p className="text-xs text-waterloo">{item.telephone}</p>
                        <p className="mt-2 font-semibold text-primary">{item.amount?.toLocaleString("fr-FR")} FC</p>
                      </div>
                      <button
                        onClick={() => handleValidate(item.playerId, item.retraitIndex)}
                        disabled={validating === key}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary disabled:opacity-60"
                      >
                        {validating === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Valider la transaction
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {retraits.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <Clock className="mb-3 h-10 w-10 text-waterloo/40" />
          <p className="text-waterloo">Aucun retrait pour le moment.</p>
          <p className="mt-1 text-xs text-waterloo/70">Les retraits effectués apparaîtront ici.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs font-medium uppercase text-waterloo dark:border-strokedark">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Montant</th>
                <th className="pb-3 pr-4">Méthode</th>
                <th className="pb-3 pr-4">Statut</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {retraits.map((r: any, i: number) => (
                <tr key={r.index ?? i} className="border-b border-stroke last:border-0 dark:border-strokedark">
                  <td className="py-3 pr-4 text-waterloo">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="py-3 pr-4 font-semibold text-black dark:text-white">
                    {r.amount?.toLocaleString("fr-FR") || 0} FC
                  </td>
                  <td className="py-3 pr-4 text-waterloo">
                    {r.method || "MOBILE_MONEY"}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] || "bg-gray-100 text-gray-500"}`}>
                      {r.status === "SUCCES" ? "Succès" : r.status === "EN_ATTENTE" ? "En attente" : r.status === "ECHEC" ? "Échec" : r.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {r.status === "EN_ATTENTE" ? (
                      <button
                        onClick={() => handleCheck(i)}
                        disabled={checkingIndex === i}
                        className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-primary transition hover:bg-primary/20 disabled:opacity-50"
                      >
                        {checkingIndex === i ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Vérifier
                      </button>
                    ) : r.status === "SUCCES" ? (
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" /> Confirmé
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" /> Échoué
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
