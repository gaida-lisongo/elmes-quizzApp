"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Search,
  Users,
  Shield,
  RefreshCw,
  Trash2,
  Settings2,
  Medal,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  deleteEnrollmentByManagerAction,
  manuallyConfirmEnrollmentByManagerAction,
  updateEnrollmentStatusByManagerAction,
  verifyEnrollmentPaymentByManagerAction,
} from "@/actions/enrollment.actions";
import {
  changeTeamCaptainAdminAction,
  getTeamAdminDetailAction,
  getTeamsAdminAction,
  removeTeamMemberAdminAction,
  updateTeamAdminAction,
} from "@/actions/equipe.actions";

export default function AdminTeamManagement() {
  const [query, setQuery] = useState("");
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCaptainId, setNewCaptainId] = useState("");
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);

  const selectedSummary = useMemo(
    () => teams.find((team) => team._id === selectedTeamId) || null,
    [teams, selectedTeamId],
  );

  const loadTeams = async () => {
    setLoadingList(true);
    const res = await getTeamsAdminAction();
    if (res.success) {
      setTeams((res.data || []).sort((a: any, b: any) => a.designation.localeCompare(b.designation)));
      if (!selectedTeamId && res.data?.[0]?._id) {
        setSelectedTeamId(res.data[0]._id);
      }
    } else {
      toast.error(res.error || "Impossible de charger les équipes.");
    }
    setLoadingList(false);
  };

  useEffect(() => {
    loadTeams();
  }, []);

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedTeamId) {
        setDetail(null);
        return;
      }

      setLoadingDetail(true);
      const res = await getTeamAdminDetailAction(selectedTeamId);
      if (res.success) {
        setDetail(res.data || null);
        setNewCaptainId(res.data?.captain?._id || "");
      } else {
        toast.error(res.error || "Impossible de charger l'équipe.");
      }
      setLoadingDetail(false);
    };

    loadDetail();
  }, [selectedTeamId]);

  const filteredTeams = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return teams;
    return teams.filter((team) =>
      [team.designation, team.captain?.pseudo, team.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }, [query, teams]);

  const refreshDetail = async () => {
    if (!selectedTeamId) return;
    const res = await getTeamAdminDetailAction(selectedTeamId);
    if (res.success) {
      setDetail(res.data || null);
      setNewCaptainId(res.data?.captain?._id || "");
    }
  };

  const handleSaveTeam = async () => {
    if (!selectedTeamId || !detail) return;
    setSaving(true);
    const res = await updateTeamAdminAction(selectedTeamId, {
      designation: detail.designation,
      description: Array.isArray(detail.description) ? detail.description.join(" ") : detail.description,
      logo: detail.logo,
      status: detail.status,
    });
    if (res.success) {
      toast.success(res.message || "Équipe mise à jour.");
      await loadTeams();
      await refreshDetail();
    } else {
      toast.error(res.error || "Mise à jour impossible.");
    }
    setSaving(false);
  };

  const handleCaptainChange = async () => {
    if (!selectedTeamId || !newCaptainId) return;
    setSaving(true);
    const res = await changeTeamCaptainAdminAction(selectedTeamId, newCaptainId);
    if (res.success) {
      toast.success(res.message || "Capitaine mis à jour.");
      await loadTeams();
      await refreshDetail();
    } else {
      toast.error(res.error || "Changement impossible.");
    }
    setSaving(false);
  };

  const handleRemoveMember = async (playerId: string) => {
    if (!selectedTeamId) return;
    setSaving(true);
    const res = await removeTeamMemberAdminAction(selectedTeamId, playerId);
    if (res.success) {
      toast.success(res.message || "Membre retiré.");
      await loadTeams();
      await refreshDetail();
    } else {
      toast.error(res.error || "Retrait impossible.");
    }
    setSaving(false);
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
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h2 className="text-xl font-semibold text-black dark:text-white">Gestion complète des équipes</h2>
          <p className="text-sm text-waterloo">Recherche, détail, capitaine, membres, invitations et statut.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher une équipe"
              className="w-full rounded-xl border border-stroke bg-transparent py-3 pl-10 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-stroke p-3 dark:border-strokedark">
            {loadingList ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredTeams.length ? (
              <div className="space-y-2">
                {filteredTeams.map((team) => {
                  const active = team._id === selectedTeamId;
                  return (
                    <button
                      key={team._id}
                      type="button"
                      onClick={() => setSelectedTeamId(team._id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-stroke hover:border-primary/60 dark:border-strokedark"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-black dark:text-white">{team.designation}</p>
                          <p className="text-xs text-waterloo">
                            {team.captain?.pseudo || "Capitaine"} • {team.status}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {team.membersCount} membre(s)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-waterloo">
                {query.trim().length < 2 ? "Toutes les équipes sont affichées." : "Aucune équipe trouvée."}
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
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-black dark:text-white">{detail.designation}</h3>
                    <p className="text-sm text-waterloo">
                      Capitaine : {detail.captain?.pseudo || "—"} • Statut : {detail.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {detail.metriques?.soldeUsd?.toLocaleString("fr-FR") || 0} USD
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Membres", value: String(detail.members?.filter((member: any) => member.status).length || 0) },
                    { label: "Invitations", value: String(detail.invitations?.length || 0) },
                    { label: "Compétitions", value: String(detail.metriques?.competitions || 0) },
                    { label: "Victoires", value: String(detail.metriques?.matchsWin || 0) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-alabaster p-3 dark:bg-strokedark">
                      <p className="text-xs uppercase text-waterloo">{item.label}</p>
                      <p className="mt-1 text-sm font-medium text-black dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                  <div className="mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-black dark:text-white">Paramètres</h4>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Désignation</span>
                      <input
                        value={detail.designation}
                        onChange={(event) => setDetail({ ...detail, designation: event.target.value })}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Description</span>
                      <textarea
                        rows={3}
                        value={Array.isArray(detail.description) ? detail.description.join(" ") : detail.description || ""}
                        onChange={(event) => setDetail({ ...detail, description: event.target.value })}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Logo</span>
                      <input
                        value={detail.logo || ""}
                        onChange={(event) => setDetail({ ...detail, logo: event.target.value })}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Statut</span>
                      <select
                        value={detail.status || "ACTIVE"}
                        onChange={(event) => setDetail({ ...detail, status: event.target.value })}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleSaveTeam}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Enregistrer
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                  <div className="mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-black dark:text-white">Capitaine et membres</h4>
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm">
                      <span className="mb-1 block text-waterloo">Nouveau capitaine</span>
                      <select
                        value={newCaptainId}
                        onChange={(event) => setNewCaptainId(event.target.value)}
                        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 outline-none dark:border-strokedark dark:text-white"
                      >
                        <option value="">Choisir un membre</option>
                        {(detail.members || []).filter((member: any) => member.status).map((member: any) => (
                          <option key={member._id} value={member._id}>{member.pseudo}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={handleCaptainChange}
                      disabled={saving || !newCaptainId}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      Changer le capitaine
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(detail.members || []).map((member: any) => (
                      <div key={member._id} className="flex items-center justify-between rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                        <div>
                          <p className="font-medium text-black dark:text-white">
                            {member.pseudo}
                            {member.isCaptain && <span className="ml-2 text-xs text-primary">(capitaine)</span>}
                          </p>
                          <p className="text-xs text-waterloo">
                            {member.isSecretary ? "Secrétaire" : "Membre"} • {member.status ? "Actif" : "Invitation"}
                          </p>
                        </div>
                        {!member.isCaptain && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member._id)}
                            disabled={saving}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-60 dark:border-red-500/30"
                          >
                            <Trash2 className="h-3 w-3" />
                            Retirer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-black dark:text-white">Invitations et enrôlements</h4>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs uppercase text-waterloo">Invitations en attente</p>
                    {detail.invitations?.length ? (
                      <div className="space-y-2">
                        {detail.invitations.map((invite: any) => (
                          <div key={invite._id} className="rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                            <p className="font-medium text-black dark:text-white">{invite.pseudo}</p>
                            <p className="text-xs text-waterloo">{invite.telephone || invite.email || "Invitation"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-waterloo">Aucune invitation.</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase text-waterloo">Enrôlements récents</p>
                    {detail.enrollments?.length ? (
                      <div className="space-y-2">
                        {detail.enrollments.slice(0, 5).map((enrollment: any) => (
                          <div key={enrollment._id} className="rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                            <p className="font-medium text-black dark:text-white">{enrollment.competitionId?.designation || enrollment.parcoursId?.designation || "Ressource"}</p>
                            <p className="text-xs text-waterloo">
                              {enrollment.sessionId?.designation || "Session"} - {enrollment.status}
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
                      <p className="text-sm text-waterloo">Aucun enrôlement.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-stroke p-6 text-sm text-waterloo dark:border-strokedark">
              {selectedSummary
                ? `Équipe sélectionnée : ${selectedSummary.designation}.`
                : "Sélectionnez une équipe pour consulter son détail."}
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}

