"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet, Loader2, RefreshCw, Clock, CheckCircle, AlertCircle,
} from "lucide-react";
import { getMyRetraitsAction, checkRetraitStatusAction } from "@/actions/payment.actions";
import toast from "react-hot-toast";

const STATUS_BADGE: Record<string, string> = {
  SUCCES: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  EN_ATTENTE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ECHEC: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function RetraitsTable() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkingIndex, setCheckingIndex] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getMyRetraitsAction();
    if (res.success) setData(res.data || null);
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