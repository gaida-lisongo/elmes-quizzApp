"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, Clock, Loader2, RefreshCw, Send, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";
import { verifyMyRechargeAction } from "@/actions/payment.actions";
import {
  approvePurchaseOrderAction,
  createPurchaseOrderAction,
  rejectPurchaseOrderAction,
} from "@/actions/equipe.actions";

export default function PlayerRecentActivity() {
  const [data, setData] = useState<PlayerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [beneficiaryPlayerId, setBeneficiaryPlayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await getPlayerMetricsAction();
    if (res.success) setData(res.data || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const verifyRecharge = async (index: number) => {
    setBusy(`recharge-${index}`);
    const res = await verifyMyRechargeAction(index);
    if (res.success) toast.success(res.message || "Recharge vérifiée.");
    else toast.error(res.error || "Vérification impossible.");
    await load();
    setBusy(null);
  };

  const createOrder = async () => {
    setBusy("create-order");
    const res = await createPurchaseOrderAction(beneficiaryPlayerId, Number(amount), reason);
    if (res.success) {
      toast.success(res.message || "Bon créé.");
      setBeneficiaryPlayerId("");
      setAmount("");
      setReason("");
      await load();
    } else {
      toast.error(res.error || "Création impossible.");
    }
    setBusy(null);
  };

  const handleOrder = async (orderId: string, action: "approve" | "reject") => {
    setBusy(`${action}-${orderId}`);
    const res = action === "approve" ? await approvePurchaseOrderAction(orderId) : await rejectPurchaseOrderAction(orderId);
    if (res.success) toast.success(res.message || "Bon mis à jour.");
    else toast.error(res.error || "Action impossible.");
    await load();
    setBusy(null);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (data?.playerType === "STANDALONE") {
    const recharges = data.recharges || [];
    return recharges.length ? (
      <div className="space-y-3">
        {recharges.map((recharge) => (
          <div key={recharge._id} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-black dark:text-white">{recharge.amount.toLocaleString("fr-FR")} FC</p>
                <p className="text-xs text-waterloo">{recharge.creditedParties} partie(s) - {recharge.providerTxId || recharge.reference || "Sans référence"}</p>
                <p className="text-xs text-waterloo">{recharge.createdAt ? new Date(recharge.createdAt).toLocaleDateString("fr-FR") : "-"}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                recharge.status === "SUCCES" ? "bg-green-100 text-green-700" :
                recharge.status === "EN_ATTENTE" ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>{recharge.status}</span>
            </div>
            {recharge.status === "EN_ATTENTE" ? (
              <button onClick={() => verifyRecharge(recharge.index)} disabled={busy === `recharge-${recharge.index}`} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary disabled:opacity-60">
                {busy === `recharge-${recharge.index}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Vérifier la recharge
              </button>
            ) : recharge.status === "SUCCES" ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-green-600"><CheckCircle className="h-3 w-3" /> Recharge validée</p>
            ) : (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" /> Recharge échouée</p>
            )}
          </div>
        ))}
      </div>
    ) : <div className="py-10 text-center text-waterloo">Aucune recharge pour le moment.</div>;
  }

  if (data?.playerType === "ADVANCED") {
    const rewards = data.rewards || [];
    return rewards.length ? (
      <div className="space-y-3">
        {rewards.map((reward) => (
          <div key={reward._id} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-black dark:text-white">{reward.parcours}</p>
                <p className="text-xs text-waterloo">{reward.session} - Rang {reward.rank || "-"}</p>
                <p className="text-xs text-waterloo">{reward.createdAt ? new Date(reward.createdAt).toLocaleDateString("fr-FR") : "-"}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">{reward.amount.toLocaleString("fr-FR")} CDF</p>
                <p className="text-xs text-waterloo">{reward.status}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : <div className="py-10 text-center text-waterloo">Aucune récompense de parcours distribuée.</div>;
  }

  const team = data?.team;
  if (data?.playerType === "VIP" && team) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-stroke bg-alabaster p-3 text-sm dark:border-strokedark dark:bg-strokedark">
          <p className="font-medium text-black dark:text-white">{team.designation}</p>
          <p className="text-xs text-waterloo">Rôle : {team.role} - Solde équipe : {team.soldeCDF.toLocaleString("fr-FR")} FC</p>
        </div>

        {team.isSecretary ? (
          <div className="space-y-2 rounded-lg border border-stroke p-3 dark:border-strokedark">
            <select value={beneficiaryPlayerId} onChange={(event) => setBeneficiaryPlayerId(event.target.value)} className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-strokedark">
              <option value="">Bénéficiaire</option>
              {team.members.filter((member) => member.status).map((member) => (
                <option key={member._id} value={member._id}>{member.pseudo}</option>
              ))}
            </select>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="1" max={team.soldeCDF || undefined} placeholder="Montant" className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-strokedark" />
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motif" className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-strokedark" />
            <button onClick={createOrder} disabled={busy === "create-order"} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-60">
              {busy === "create-order" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Créer le bon
            </button>
          </div>
        ) : null}

        {team.purchaseOrders.length ? (
          <div className="space-y-3">
            {team.purchaseOrders.map((order) => (
              <div key={order._id} className="rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-black dark:text-white">{order.beneficiaryPseudo}</p>
                    <p className="text-xs text-waterloo">{order.reason}</p>
                    <p className="text-xs text-waterloo">{order.createdAt ? new Date(order.createdAt).toLocaleDateString("fr-FR") : "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-primary">{order.amount.toLocaleString("fr-FR")}</p>
                    <p className="text-xs text-waterloo">{order.status}</p>
                  </div>
                </div>
                {order.canApprove ? (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleOrder(order._id, "approve")} disabled={busy === `approve-${order._id}`} className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1.5 text-xs font-medium text-green-700 disabled:opacity-60">
                      {busy === `approve-${order._id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      Valider
                    </button>
                    <button onClick={() => handleOrder(order._id, "reject")} disabled={busy === `reject-${order._id}`} className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60">
                      {busy === `reject-${order._id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Refuser
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : <div className="py-8 text-center text-waterloo">Aucun bon de commande.</div>}
      </div>
    );
  }

  return <div className="py-10 text-center text-waterloo"><Clock className="mx-auto mb-2 h-8 w-8" />Aucune activité récente.</div>;
}
