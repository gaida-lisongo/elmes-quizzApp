"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Clock,
  Crown,
  Loader2,
  Users,
  BarChart3,
  Target,
  UserPlus,
  X,
  Search,
  CheckCircle,
  XCircle,
  LogOut,
  Shield,
  ShieldOff,
} from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";
import { inviteMemberAction, leaveEquipeAction, respondEquipeInvitationAction, searchInvitableVipPlayersAction, updateMemberRoleAction } from "@/actions/equipe.actions";
import PlayerRecentActivity from "../PlayerRecentActivity";
import toast from "react-hot-toast";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

export default function VipDashboard() {
  const [data, setData] = useState<PlayerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
      setLoading(true);
      const res = await getPlayerMetricsAction();
      if (res.success) setData(res.data || null);
      setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!inviteOpen || searchQuery.trim().length < 2) {
      setInviteResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const res = await searchInvitableVipPlayersAction(searchQuery);
      if (res.success) setInviteResults(res.players || []);
      else toast.error(res.error || "Recherche impossible.");
      setSearching(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [inviteOpen, searchQuery]);

  const handleInvite = async (playerId: string) => {
    if (!data?.team?._id) return;
    setActionLoading(`invite-${playerId}`);
    const res = await inviteMemberAction(data.team._id, playerId);
    if (res.success) {
      toast.success("Invitation envoyée.");
      setSearchQuery("");
      setInviteResults([]);
      setInviteOpen(false);
      await load();
    } else {
      toast.error(res.error || "Invitation impossible.");
    }
    setActionLoading(null);
  };

  const handleInvitationResponse = async (response: "ACCEPT" | "DECLINE") => {
    if (!data?.team?._id) return;
    setActionLoading(response);
    const res = await respondEquipeInvitationAction(data.team._id, response);
    if (res.success) {
      toast.success(response === "ACCEPT" ? "Invitation acceptée." : "Invitation refusée.");
      await load();
    } else {
      toast.error(res.error || "Action impossible.");
    }
    setActionLoading(null);
  };

  const handleLeaveEquipe = async () => {
    if (!data?.team?._id) return;
    setActionLoading("leave");
    const res = await leaveEquipeAction(data.team._id);
    if (res.success) {
      toast.success("Vous avez quitté l'équipe.");
      await load();
    } else {
      toast.error(res.error || "Retrait impossible.");
    }
    setActionLoading(null);
  };

  const handleSecretary = async (playerId: string, isSecretary: boolean) => {
    if (!data?.team?._id) return;
    const action = isSecretary ? "UNSET_SECRETARY" : "SET_SECRETARY";
    setActionLoading(`${action}-${playerId}`);
    const res = await updateMemberRoleAction(data.team._id, playerId, action);
    if (res.success) {
      toast.success("Rôle mis à jour.");
      await load();
    } else {
      toast.error(res.error || "Mise à jour impossible.");
    }
    setActionLoading(null);
  };

  const stats = data ? [
    { label: "Questions OK / Total", value: `${data.averages.questions.ok}/${data.averages.questions.total}`, icon: <Target className="h-5 w-5" />, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Score total", value: `${data.stats.scoreTotal} pts`, icon: <TrendingUp className="h-5 w-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: "Précision", value: `${data.stats.precision}%`, icon: <Crown className="h-5 w-5" />, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
    { label: "Gains de votre équipe", value: data.team ? `${(data.team.soldeCDF || 0).toLocaleString("fr-FR")} FC` : "0 FC", icon: <Users className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  ] : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard Compétiteur</h1>
            <p className="text-waterloo">Affrontez les meilleurs et remportez des lots</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} custom={i} variants={fadeInUp} initial="hidden" animate="visible" className="rounded-2xl border border-stroke bg-white p-5 shadow-solid-5 transition-all duration-300 hover:shadow-lg dark:border-strokedark dark:bg-blacksection">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <div className={stat.color}>{stat.icon}</div>
                </div>
                <p className="text-2xl font-bold text-black dark:text-white">{stat.value}</p>
                <p className="text-sm text-waterloo">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Top & classement — ligne pleine largeur */}
          <div className="hidden">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Top & classement</h2>
              </div>
              <div className="rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                <p className="text-sm text-waterloo">Votre position</p>
                <p className="mt-1 text-2xl font-bold text-black dark:text-white">{data?.top.value || '—'}</p>
                <p className="mt-1 text-sm text-waterloo">{data?.top.detail || 'Pas encore classé'}</p>
              </div>
              <div className="mt-4 space-y-2">
                {data?.leaderboard?.slice(0, 5).map((player) => (
                  <div key={player._id} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                    <span className="font-medium text-black dark:text-white">#{player.rank} {player.pseudo}</span>
                    <span className="text-waterloo">{player.score} pts</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Chart 2/3 + Activité 1/3 */}
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Équipe & sessions</h2>
              </div>
              {data?.team ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-stroke bg-alabaster p-3 dark:border-strokedark dark:bg-strokedark">
                    <p className="text-sm font-medium text-black dark:text-white">{data.team.designation}</p>
                    <p className="text-xs text-waterloo">Rôle : {data.team.role}</p>
                    {!data.team.status && (
                      <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/20 dark:bg-yellow-500/10">
                        <p className="text-sm font-semibold text-black dark:text-white">Invitation en attente</p>
                        <p className="mt-1 text-xs text-waterloo">Acceptez l'invitation pour accéder aux sessions de l'équipe.</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleInvitationResponse("ACCEPT")}
                            disabled={actionLoading === "ACCEPT"}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {actionLoading === "ACCEPT" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Accepter
                          </button>
                          <button
                            onClick={() => handleInvitationResponse("DECLINE")}
                            disabled={actionLoading === "DECLINE"}
                            className="inline-flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 text-xs font-medium text-black disabled:opacity-60 dark:border-strokedark dark:text-white"
                          >
                            {actionLoading === "DECLINE" ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Décliner
                          </button>
                        </div>
                      </div>
                    )}
                    {data.team.isCaptain && data.team.status && (
                      <button
                        onClick={() => setInviteOpen(true)}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primaryho"
                      >
                        <UserPlus className="h-4 w-4" />
                        Invitation
                      </button>
                    )}
                    {!data.team.isCaptain && data.team.status && (
                      <button
                        onClick={handleLeaveEquipe}
                        disabled={actionLoading === "leave"}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-500/30 dark:hover:bg-red-500/10"
                      >
                        {actionLoading === "leave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        Quitter l'équipe
                      </button>
                    )}
                  </div>
                  {data.team.members.map((member) => (
                    <div key={member._id} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                      <div>
                        <span className="font-medium text-black dark:text-white">{member.pseudo}</span>
                        {member.isCurrentUser && <span className="ml-2 text-xs text-waterloo">(moi)</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-waterloo">{member.isSecretary ? 'Secrétaire' : member.status ? 'Membre' : 'Invité'}</span>
                        {(data?.team && data.team.isCaptain) && !member.isCurrentUser && member.status && (
                          <button
                            onClick={() => handleSecretary(member._id, member.isSecretary)}
                            disabled={actionLoading === `${member.isSecretary ? "UNSET_SECRETARY" : "SET_SECRETARY"}-${member._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-stroke px-2 py-1 text-xs font-medium text-black transition hover:border-primary disabled:opacity-60 dark:border-strokedark dark:text-white"
                          >
                            {actionLoading === `${member.isSecretary ? "UNSET_SECRETARY" : "SET_SECRETARY"}-${member._id}` ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : member.isSecretary ? (
                              <ShieldOff className="h-3 w-3" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            {member.isSecretary ? "Retirer" : "Secrétaire"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {data.team.status && (
                    <div className="rounded-lg border border-stroke p-4 dark:border-strokedark">
                      <div className="mb-3 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        <p className="font-medium text-black dark:text-white">Sessions</p>
                      </div>
                      {data.sessions.length ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {data.sessions.map((session) => (
                            <div key={session.label} className="rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                              <p className="font-medium text-black dark:text-white">{session.label}</p>
                              <p className="text-xs text-waterloo">{session.count} inscription(s)</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-waterloo">Aucune session liée à l'équipe.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-10 text-center text-waterloo">Aucune équipe liée à ce profil.</div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Bons de commande</h2>
              </div>
              <PlayerRecentActivity />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="hidden">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Activité récente</h2>
              </div>
              {data?.recentParties?.length ? (
                <div className="space-y-3">
                  {data.recentParties.map((party) => (
                    <div key={party._id} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                      <div>
                        <p className="font-medium text-black dark:text-white">{party.categorie}</p>
                        <p className="text-waterloo">{new Date(party.createdAt).toLocaleDateString("fr-FR")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-primary">{party.note} pts</p>
                        <p className="text-xs text-waterloo">{party.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-waterloo">Aucune activité récente.</div>
              )}
            </motion.div>
          </div>
        </>
      )}
      {inviteOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(event) => event.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Inviter un VIP</h3>
                <p className="text-xs text-waterloo">Joueurs libres, non membres et non capitaines.</p>
              </div>
              <button
                onClick={() => setInviteOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Pseudo, téléphone ou email"
                  className="w-full rounded-lg border border-stroke bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                />
              </div>

              <div className="mt-5 space-y-3">
                {searching ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : inviteResults.length ? (
                  inviteResults.map((player) => (
                    <button
                      key={player._id}
                      onClick={() => handleInvite(player._id)}
                      disabled={actionLoading === `invite-${player._id}`}
                      className="flex w-full items-center justify-between rounded-xl border border-stroke p-4 text-left transition hover:border-primary disabled:opacity-60 dark:border-strokedark"
                    >
                      <div>
                        <p className="font-medium text-black dark:text-white">{player.pseudo}</p>
                        <p className="text-xs text-waterloo">{player.telephone || player.email || "VIP disponible"}</p>
                      </div>
                      {actionLoading === `invite-${player._id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-sm text-waterloo">
                    {searchQuery.trim().length < 2 ? "Saisissez au moins 2 caractères." : "Aucun VIP disponible."}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
