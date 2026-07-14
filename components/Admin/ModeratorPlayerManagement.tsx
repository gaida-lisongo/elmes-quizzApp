"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Search,
  User,
  Gamepad2,
  Medal,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteEnrollmentByManagerAction,
  manuallyConfirmEnrollmentByManagerAction,
  updateEnrollmentStatusByManagerAction,
  verifyEnrollmentPaymentByManagerAction,
} from "@/actions/enrollment.actions";
import {
  getModeratorPlayerDetailAction,
  grantPlayerBonusPartiesAction,
  searchModeratorPlayersAction,
  updatePlayerLevelAction,
} from "@/actions/player.metrics.actions";

export default function ModeratorPlayerManagement() {
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingLevel, setUpdatingLevel] = useState(false);
  const [bonusCount, setBonusCount] = useState(3);
  const [bonusReason, setBonusReason] = useState("");
  const [grantingBonus, setGrantingBonus] = useState(false);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => players.find((player) => player.playerId === selectedPlayerId || player._id === selectedPlayerId) || null,
    [players, selectedPlayerId],
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setPlayers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      const res = await searchModeratorPlayersAction(query);
      if (res.success) {
        setPlayers(res.players || []);
      } else {
        toast.error(res.error || "Recherche impossible.");
      }
      setLoadingSearch(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedPlayerId) {
        setDetail(null);
        return;
      }

      setLoadingDetail(true);
      const res = await getModeratorPlayerDetailAction(selectedPlayerId);
      if (res.success) {
        setDetail(res.data || null);
      } else {
        toast.error(res.error || "Impossible de charger le joueur.");
      }
      setLoadingDetail(false);
    };

    loadDetail();
  }, [selectedPlayerId]);

  const handleUpdateLevel = async () => {
    if (!selectedPlayerId || !detail?.profile) return;
    setUpdatingLevel(true);
    const res = await updatePlayerLevelAction(selectedPlayerId, detail.profile.level);
    if (res.success) {
      toast.success(res.message || "Niveau mis à jour.");
      const refreshed = await getModeratorPlayerDetailAction(selectedPlayerId);
      if (refreshed.success) setDetail(refreshed.data || null);
    } else {
      toast.error(res.error || "Mise à jour impossible.");
    }
    setUpdatingLevel(false);
  };

  const handleGrantBonus = async () => {
    if (!selectedPlayerId) return;
    setGrantingBonus(true);
    const res = await grantPlayerBonusPartiesAction(selectedPlayerId, bonusCount, bonusReason);
    if (res.success) {
      toast.success(res.message || "Bonus attribué.");
      const refreshed = await getModeratorPlayerDetailAction(selectedPlayerId);
      if (refreshed.success) setDetail(refreshed.data || null);
      setBonusReason("");
    } else {
      toast.error(res.error || "Attribution impossible.");
    }
    setGrantingBonus(false);
  };

  const refreshDetail = async () => {
    if (!selectedPlayerId) return;
    const refreshed = await getModeratorPlayerDetailAction(selectedPlayerId);
    if (refreshed.success) setDetail(refreshed.data || null);
  };

  const handleEnrollmentAction = async (
    enrollmentId: string,
    action: "verify" | "validate" | "delete",
  ) => {
    if (action === "delete" && !confirm("Supprimer définitivement cet enrôlement ?")) return;
    setBusyEnrollmentId(enrollmentId);
    const res =
      action === "verify"
        ? await verifyEnrollmentPaymentByManagerAction(enrollmentId)
        : action === "validate"
          ? await manuallyConfirmEnrollmentByManagerAction(enrollmentId)
          : await deleteEnrollmentByManagerAction(enrollmentId);

    if (res.success) {
      toast.success(res.message || "Action effectuée.");
      await refreshDetail();
    } else {
      toast.error(res.error || "Action impossible.");
    }
    setBusyEnrollmentId(null);
  };

  const handleEnrollmentStatus = async (enrollmentId: string, status: "PENDING" | "CONFIRMED" | "CANCELLED") => {
    setBusyEnrollmentId(enrollmentId);
    const res = await updateEnrollmentStatusByManagerAction(enrollmentId, status);
    if (res.success) {
      toast.success(res.message || "Statut mis à jour.");
      await refreshDetail();
    } else {
      toast.error(res.error || "Changement de statut impossible.");
    }
    setBusyEnrollmentId(null);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
    >
      <div className="mb-5 flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white">Gestion des joueurs</h2>
          <p className="text-sm text-waterloo">Recherche, profil, parties, niveau et bonus.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nom, pseudo, email, ID, niveau, statut"
              className="w-full rounded-xl border border-stroke bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-stroke p-3 dark:border-strokedark">
            {loadingSearch ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : players.length ? (
              <div className="space-y-2">
                {players.map((player) => {
                  const active = (player.playerId || player._id) === selectedPlayerId;
                  return (
                    <button
                      key={player.playerId || player._id}
                      type="button"
                      onClick={() => setSelectedPlayerId(player.playerId || player._id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-stroke hover:border-primary/60 dark:border-strokedark"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-black dark:text-white">{player.pseudo}</p>
                          <p className="text-xs text-waterloo">
                            {player.type} • {player.statut} • Niv. {player.level}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {player.score || 0} pts
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-waterloo">
                {query.trim().length < 2 ? "Saisissez au moins 2 caractères." : "Aucun joueur trouvé."}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {loadingDetail ? (
            <div className="flex items-center justify-center rounded-xl border border-stroke p-10 dark:border-strokedark">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : detail ? (
            <>
              <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-black dark:text-white">{detail.profile.pseudo}</h3>
                    <p className="text-sm text-waterloo">
                      {detail.profile.type} • {detail.profile.statut} • {detail.profile.telephone}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {detail.profile.score} pts
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Niveau", value: `Niv. ${detail.profile.level}` },
                    { label: "Parties", value: String(detail.profile.parties || 0) },
                    { label: "Email", value: detail.profile.email || "—" },
                    { label: "Statut", value: detail.profile.statut },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-alabaster p-3 dark:bg-strokedark">
                      <p className="text-xs uppercase text-waterloo">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-black dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                    <span className="text-waterloo">Niveau</span>
                    <select
                      value={detail.profile.level}
                      onChange={(event) => setDetail({
                        ...detail,
                        profile: { ...detail.profile, level: Number(event.target.value) },
                      })}
                      className="bg-transparent text-black outline-none dark:text-white"
                    >
                      {[0, 1, 2, 3].map((level) => (
                        <option key={level} value={level}>Niv. {level}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={handleUpdateLevel}
                    disabled={updatingLevel}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {updatingLevel ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Mettre à jour
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                  <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-black dark:text-white">Attribution de bonus</h4>
                  </div>
                  <div className="grid gap-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Nombre de parties</span>
                      <input
                        type="number"
                        min={1}
                        value={bonusCount}
                        onChange={(event) => setBonusCount(Math.max(1, Number(event.target.value) || 1))}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Motif</span>
                      <textarea
                        rows={3}
                        value={bonusReason}
                        onChange={(event) => setBonusReason(event.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleGrantBonus}
                      disabled={grantingBonus}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {grantingBonus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Attribuer
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                  <div className="mb-3 flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-black dark:text-white">Dernières parties</h4>
                  </div>
                  {detail.games.length ? (
                    <div className="space-y-2">
                      {detail.games.map((game: any) => (
                        <div key={game._id} className="rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-black dark:text-white">{game.category}</p>
                              <p className="text-xs text-waterloo">
                                {game.session || "Session"} • {game.mode}
                              </p>
                            </div>
                            <span className="font-semibold text-primary">{game.score} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-waterloo">Aucune partie récente.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-black dark:text-white">Enrôlements liés</h4>
                </div>
                {detail.enrollments.length ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {detail.enrollments.map((enrollment: any) => (
                      <div key={enrollment._id} className="rounded-lg bg-alabaster p-3 text-sm dark:bg-strokedark">
                        <p className="font-medium text-black dark:text-white">{enrollment.resource}</p>
                        <p className="text-xs text-waterloo">{enrollment.session}</p>
                        <p className="mt-2 text-xs text-waterloo">
                          {enrollment.points} pts - {enrollment.remainingGames} parties restantes - {enrollment.status}
                        </p>
                        <div className="mt-3 grid gap-2">
                          <select
                            value={enrollment.status}
                            onChange={(event) => handleEnrollmentStatus(enrollment._id, event.target.value as "PENDING" | "CONFIRMED" | "CANCELLED")}
                            disabled={busyEnrollmentId === enrollment._id}
                            className="w-full rounded-lg border border-stroke bg-white px-2 py-1.5 text-xs text-black outline-none dark:border-strokedark dark:bg-black dark:text-white"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="CONFIRMED">CONFIRMED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEnrollmentAction(enrollment._id, "verify")}
                              disabled={busyEnrollmentId === enrollment._id}
                              className="inline-flex items-center gap-1 rounded-md border border-stroke px-2 py-1 text-xs text-black disabled:opacity-50 dark:border-strokedark dark:text-white"
                            >
                              <RefreshCw className="h-3 w-3" /> Verifier
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEnrollmentAction(enrollment._id, "validate")}
                              disabled={busyEnrollmentId === enrollment._id || enrollment.status === "CONFIRMED"}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 disabled:opacity-50"
                            >
                              <ShieldCheck className="h-3 w-3" /> Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEnrollmentAction(enrollment._id, "delete")}
                              disabled={busyEnrollmentId === enrollment._id}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" /> Supprimer
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-waterloo">Aucun enrôlement lié.</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-stroke p-6 text-sm text-waterloo dark:border-strokedark">
              {selectedSummary
                ? `Joueur sélectionné : ${selectedSummary.pseudo}.`
                : "Sélectionnez un joueur pour consulter son profil."}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

