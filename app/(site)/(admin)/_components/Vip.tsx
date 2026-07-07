"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, UserPlus, UserX, Shield, ShieldOff, Loader2, Crown, Search,
} from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";
import { searchUsers } from "@/actions/payment.actions";
import { inviteMemberAction, updateMemberRoleAction, getMyEquipeDetailAction } from "@/actions/equipe.actions";
import toast from "react-hot-toast";

export default function VipMembresTable() {
  const [data, setData] = useState<PlayerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipeDetail, setEquipeDetail] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const res = await getPlayerMetricsAction();
    if (res.success) {
      setData(res.data || null);
      if (res.data?.team) {
        const detail = await getMyEquipeDetailAction(res.data.team.members.find((m) => m.isCurrentUser)?._id || "");
        if (detail.success) setEquipeDetail(detail.data);
      }
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchUsers(searchQuery);
      if (res.success) setSearchResults(res.users || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleInvite = async (playerId: string) => {
    if (!equipeDetail) return;
    setActionLoading(`invite-${playerId}`);
    const res = await inviteMemberAction(equipeDetail._id, playerId);
    if (res.success) {
      toast.success("Invitation envoyée !");
      setInviteTarget(null);
      setSearchQuery("");
      await loadData();
    } else {
      toast.error(res.error || "Erreur d'invitation.");
    }
    setActionLoading(null);
  };

  const handleRoleChange = async (playerId: string, action: 'SET_SECRETARY' | 'UNSET_SECRETARY' | 'REVOKE') => {
    if (!equipeDetail) return;
    setActionLoading(`${action}-${playerId}`);
    const res = await updateMemberRoleAction(equipeDetail._id, playerId, action);
    if (res.success) {
      toast.success("Membre mis à jour.");
      await loadData();
    } else {
      toast.error(res.error || "Erreur de mise à jour.");
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isCaptain = equipeDetail?.isCaptain || false;
  const isSecretary = equipeDetail?.isSecretary || false;
  const membres = equipeDetail?.membres || data?.team?.members || [];

  return (
    <div className="space-y-6">
      {/* Infos équipe */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
      >
        <div className="mb-4 flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">
            {equipeDetail?.designation || data?.team?.designation || "Mon équipe"}
          </h2>
          {isCaptain && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Capitaine
            </span>
          )}
          {isSecretary && !isCaptain && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              Secrétaire
            </span>
          )}
        </div>

        {/* Recherche & invitation (capitaine seulement) */}
        {(isCaptain || isSecretary) && (
          <div className="mb-4 relative">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un joueur à inviter…"
                  className="w-full rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                />
              </div>
            </div>
            {searchQuery.length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-stroke bg-white shadow-lg dark:border-strokedark dark:bg-blacksection">
                {searching ? (
                  <div className="flex items-center justify-center p-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
                ) : searchResults.length === 0 ? (
                  <p className="p-3 text-center text-sm text-waterloo">Aucun résultat</p>
                ) : searchResults.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleInvite(u.playerId || u._id)}
                    disabled={actionLoading === `invite-${u.playerId}`}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition hover:bg-stroke dark:hover:bg-strokedark disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4 text-primary" />
                    <span className="font-medium text-black dark:text-white">{u.pseudo}</span>
                    <span className="text-waterloo">{u.telephone}</span>
                    {actionLoading === `invite-${u.playerId}` && <Loader2 className="ml-auto h-3 w-3 animate-spin" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Table des membres */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stroke text-xs font-medium uppercase text-waterloo dark:border-strokedark">
                <th className="pb-3 pr-4">Membre</th>
                <th className="pb-3 pr-4">Rôle</th>
                <th className="pb-3 pr-4">Statut</th>
                {isCaptain && <th className="pb-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {membres.length === 0 ? (
                <tr><td colSpan={isCaptain ? 4 : 3} className="py-8 text-center text-waterloo">Aucun membre dans l'équipe.</td></tr>
              ) : membres.map((m: any) => (
                <tr key={m._id} className="border-b border-stroke last:border-0 dark:border-strokedark">
                  <td className="py-3 pr-4 font-medium text-black dark:text-white">
                    {m.pseudo || "Membre"}
                    {m.isCurrentUser && <span className="ml-2 text-xs text-waterloo">(moi)</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {m.isSecretary ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        <Shield className="h-3 w-3" /> Secrétaire
                      </span>
                    ) : (
                      <span className="text-waterloo">Membre</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m.status ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {m.status ? "Actif" : "En attente"}
                    </span>
                  </td>
                  {isCaptain && !m.isCurrentUser && (
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {!m.isSecretary ? (
                          <button
                            onClick={() => handleRoleChange(m._id, 'SET_SECRETARY')}
                            disabled={actionLoading === `SET_SECRETARY-${m._id}`}
                            className="flex items-center gap-1 rounded-lg bg-purple-50 px-2 py-1 text-xs text-purple-600 transition hover:bg-purple-100 disabled:opacity-50 dark:bg-purple-900/20"
                          >
                            {actionLoading === `SET_SECRETARY-${m._id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                            Secrétaire
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(m._id, 'UNSET_SECRETARY')}
                            disabled={actionLoading === `UNSET_SECRETARY-${m._id}`}
                            className="flex items-center gap-1 rounded-lg bg-orange-50 px-2 py-1 text-xs text-orange-600 transition hover:bg-orange-100 disabled:opacity-50 dark:bg-orange-900/20"
                          >
                            {actionLoading === `UNSET_SECRETARY-${m._id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldOff className="h-3 w-3" />}
                            Rétrograder
                          </button>
                        )}
                        <button
                          onClick={() => handleRoleChange(m._id, 'REVOKE')}
                          disabled={actionLoading === `REVOKE-${m._id}`}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20"
                        >
                          {actionLoading === `REVOKE-${m._id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                          Révoquer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
