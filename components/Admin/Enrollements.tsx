"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Plus, X, Trash2, Edit3, Loader2,
  Users, CheckCircle, AlertCircle, ChevronRight,
  ArrowLeft, Search, BookOpen, FileText, RefreshCw, Mail, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getActiveSessionsAction, getAllSessionsAction,
  createSessionAction, deleteSessionAction,
  updateSessionRessourcesAction, getAvailableRessourcesAction,
  getEnrollementsByRessourceAction,
  updateSessionStatusAction,
  verifyEnrollmentPaymentByManagerAction,
  manuallyConfirmEnrollmentByManagerAction,
  resendEnrollmentEmailByManagerAction,
  deleteEnrollmentByManagerAction,
} from "@/actions/enrollment.actions";

/* ================================================================
   Types
   ================================================================ */
interface SessionItem {
  _id: string;
  slug: string;
  designation: string;
  type?: "parcours" | "competition";
  status?: "ACTIVE" | "INACTIVE" | "COMPLETED" | "PAYMENT";
  startDate: string;
  endDate: string;
  ressources?: { type: "Parcours" | "Competition"; refId: any }[];
  enrollmentFeeCDF?: number;
  totalValidatedEnrollments?: number;
  totalCollectedCDF?: number;
  platformAmountCDF?: number;
  scholarshipInitialAmountCDF?: number;
  scholarshipDistributedAmountCDF?: number;
  scholarshipRemainingAmountCDF?: number;
  totalGrantedGames?: number;
  unitRewardPerWonGameCDF?: number;
  gamesPerEnrollment?: number;
}

interface RessourceItem {
  _id: string;
  designation: string;
  slug: string;
  amount?: number;
  cagnotte?: number;
}

interface EnrolledItem {
  _id: string;
  playerId?: { _id: string; userId?: { pseudo: string; telephone: string; email?: string } };
  equipeId?: { _id: string; designation: string; chefId?: { userId?: { email?: string; pseudo?: string; telephone?: string } } };
  code: string;
  orderNumber?: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  parties: number;
  remainingGames?: number;
  transactions?: Array<{ orderNumber: string; status: string; montant: number; currency?: "CDF" | "USD" }>;
  createdAt: string;
}

type Step = "sessions" | "resources" | "enrolled";

/* ================================================================
   Modal Session (2 étapes)
   ================================================================ */
const SessionModal = ({
  mode,
  session,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  session?: SessionItem | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [etape, setEtape] = useState(1);
  const [form, setForm] = useState({
    designation: session?.designation || "",
    type: session?.type || "parcours",
    startDate: session?.startDate?.split("T")[0] || "",
    endDate: session?.endDate?.split("T")[0] || "",
  });
  const [availableParcours, setAvailableParcours] = useState<RessourceItem[]>([]);
  const [availableCompetitions, setAvailableCompetitions] = useState<RessourceItem[]>([]);
  const [selectedRessources, setSelectedRessources] = useState<{ type: "Parcours" | "Competition"; refId: string }[]>(
    session?.ressources?.map((r: any) => ({ type: r.type, refId: r.refId?._id || r.refId })) || []
  );
  const [createdId, setCreatedId] = useState<string | null>(session?._id || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRessources, setLoadingRessources] = useState(false);

  useEffect(() => {
    if (etape === 2) {
      setLoadingRessources(true);
      getAvailableRessourcesAction().then((res) => {
        if (res.success && res.ressources) {
          setAvailableParcours(res.ressources.parcours);
          setAvailableCompetitions(res.ressources.competitions);
        }
        setLoadingRessources(false);
      });
    }
  }, [etape]);

  const isRessourceSelected = (type: string, id: string) =>
    selectedRessources.some(r => r.type === type && r.refId === id);

  const toggleRessource = (type: "Parcours" | "Competition", refId: string) => {
    setSelectedRessources(prev =>
      prev.some(r => r.type === type && r.refId === refId)
        ? prev.filter(r => !(r.type === type && r.refId === refId))
        : [...prev.filter((item) => item.type === type), { type, refId }]
    );
  };

  const handleStep1 = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.designation || !form.startDate || !form.endDate) {
        throw new Error("Tous les champs sont obligatoires.");
      }
      if (new Date(form.endDate) <= new Date(form.startDate)) {
        throw new Error("La date de fin doit être après la date de début.");
      }

      if (mode === "create" || !createdId) {
        const res = await createSessionAction(form as any);
        if (!res.success) throw new Error(res.error);
        setCreatedId(res.session._id);
      }
      setEtape(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStep2 = async () => {
    if (!createdId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updateSessionRessourcesAction(createdId, selectedRessources);
      if (!res.success) throw new Error(res.error);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection" onClick={(e) => e.stopPropagation()}>
        
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-black dark:text-white">
            <Calendar className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nouvelle session" : "Modifier la session"}
          </h3>
          <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        {/* Stepper 2 étapes */}
        <div className="mb-6 flex items-center gap-2">
          {[
            { key: 1, num: 1, label: "Déclaration" },
            { key: 2, num: 2, label: "Ressources" },
          ].map((s) => (
            <div key={s.key} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                etape === s.key ? "bg-primary text-white" : etape > s.key ? "bg-meta text-white" : "bg-stroke text-manatee dark:bg-strokedark"
              }`}>{s.num}</div>
              <span className={`text-xs ${etape === s.key ? "text-primary font-medium" : "text-waterloo"}`}>{s.label}</span>
              {s.key < 2 && <div className={`h-0.5 flex-1 ${etape > s.key ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />}
            </div>
          ))}
        </div>

        {etape === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Désignation</label>
              <input type="text" value={form.designation} onChange={(e) => setForm(f => ({ ...f, designation: e.target.value }))}
                placeholder="Ex: Session Juillet 2026"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(["parcours", "competition"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, type: item }));
                      setSelectedRessources([]);
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      form.type === item
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                    }`}
                  >
                    {item === "parcours" ? "Parcours" : "CompÃ©tition"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Date début</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Date fin</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
              </div>
            </div>
          </div>
        )}

        {etape === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-waterloo">
              <BookOpen className="h-4 w-4" />
              <h4 className="font-medium text-black dark:text-white">Associer des ressources</h4>
            </div>

            {loadingRessources ? (
              <div className="flex flex-col items-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-waterloo">Chargement...</p></div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Parcours */}
                <div>
                  <h5 className="mb-2 text-xs font-semibold uppercase text-waterloo">Parcours</h5>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {availableParcours.map(p => (
                      <button key={p._id} disabled={form.type !== "parcours"} onClick={() => toggleRessource("Parcours", p._id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                          isRessourceSelected("Parcours", p._id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary disabled:opacity-40 dark:border-strokedark"
                        }`}>{p.designation}</button>
                    ))}
                    {availableParcours.length === 0 && <p className="text-xs text-waterloo/60">Aucun parcours actif</p>}
                  </div>
                </div>
                {/* Compétitions */}
                <div>
                  <h5 className="mb-2 text-xs font-semibold uppercase text-waterloo">Compétitions</h5>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {availableCompetitions.map(c => (
                      <button key={c._id} disabled={form.type !== "competition"} onClick={() => toggleRessource("Competition", c._id)}
                        className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition ${
                          isRessourceSelected("Competition", c._id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke text-waterloo hover:border-primary disabled:opacity-40 dark:border-strokedark"
                        }`}>{c.designation}</button>
                    ))}
                    {availableCompetitions.length === 0 && <p className="text-xs text-waterloo/60">Aucune compétition active</p>}
                  </div>
                </div>
              </div>
            )}

            {/* Résumé sélections */}
            {selectedRessources.length > 0 && (
              <div className="rounded-lg bg-alabaster p-3 dark:bg-strokedark">
                <p className="text-xs font-medium text-black dark:text-white">{selectedRessources.length} ressource(s) sélectionnée(s)</p>
                {selectedRessources.map(r => (
                  <p key={r.refId} className="mt-1 text-[10px] text-waterloo">
                    {r.type === "Parcours" ? "📘" : "🏆"} {availableParcours.find(p => p._id === r.refId)?.designation || availableCompetitions.find(c => c._id === r.refId)?.designation || r.refId}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {etape > 1 && (
              <button onClick={() => setEtape(1)}
                className="flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
            )}
          </div>
          <button onClick={etape === 1 ? handleStep1 : handleStep2} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm text-white transition hover:bg-primaryho disabled:opacity-50">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : etape === 1 ? "Suivant" : "Terminer"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Composant principal Enrollements
   ================================================================ */
export default function Enrollements() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("sessions");
  const [selectedSession, setSelectedSession] = useState<SessionItem | null>(null);
  const [selectedRessource, setSelectedRessource] = useState<{ type: "Parcours" | "Competition"; name: string; refId: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editSession, setEditSession] = useState<SessionItem | null>(null);
  const [search, setSearch] = useState("");

  // Real data states
  const [ressources, setRessources] = useState<{ type: "Parcours" | "Competition"; refId: string; name: string }[]>([]);
  const [enrolledList, setEnrolledList] = useState<EnrolledItem[]>([]);
  const [ressourcesLoading, setRessourcesLoading] = useState(false);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const res = await getAllSessionsAction();
    if (res.success) setSessions(res.sessions);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer définitivement cette session ?")) return;
    await deleteSessionAction(id);
    fetchSessions();
  };

  const handleUpdateStatus = async (session: SessionItem, status: "ACTIVE" | "INACTIVE" | "COMPLETED" | "PAYMENT", e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await updateSessionStatusAction(session._id, status);
    if (res.success) {
      fetchSessions();
      if (selectedSession?._id === session._id && res.session) setSelectedSession(res.session);
    } else {
      alert(res.error || "Changement de statut impossible.");
    }
  };

  const getSessionType = (session: SessionItem) =>
    session.type || ((session.ressources || []).some((r) => r.type === "Competition") ? "competition" : "parcours");

  const getStatusWorkflow = (session: SessionItem) =>
    getSessionType(session) === "competition"
      ? (["ACTIVE", "INACTIVE", "COMPLETED"] as const)
      : (["ACTIVE", "PAYMENT"] as const);

  const handleSelectSession = (session: SessionItem) => {
    setSelectedSession(session);
    setStep("resources");
    setRessourcesLoading(true);
    const sessionRessources = (session.ressources || []).map((r: any) => ({
      type: r.type as "Parcours" | "Competition",
      refId: r.refId?._id || r.refId,
      name: r.refId?.designation || (r.type === "Parcours" ? "Parcours" : "Compétition"),
    }));
    setRessources(sessionRessources);
    setRessourcesLoading(false);
  };

  const handleSelectRessource = async (type: "Parcours" | "Competition", refId: string, name: string) => {
    if (!selectedSession) return;
    setSelectedRessource({ type, name, refId });
    setStep("enrolled");
    setEnrolledLoading(true);
    setSearch("");
    const res = await getEnrollementsByRessourceAction(type, refId, selectedSession._id);
    if (res.success) setEnrolledList(res.enrollements);
    setEnrolledLoading(false);
  };

  const reloadEnrolled = async () => {
    if (!selectedSession || !selectedRessource) return;
    setEnrolledLoading(true);
    const res = await getEnrollementsByRessourceAction(selectedRessource.type, selectedRessource.refId, selectedSession._id);
    if (res.success) setEnrolledList(res.enrollements);
    else toast.error(res.error || "Chargement des enrollements impossible.");
    setEnrolledLoading(false);
  };

  const handleEnrollmentAction = async (
    enrollmentId: string,
    action: "verify" | "manual" | "mail" | "delete",
  ) => {
    if (action === "delete" && !confirm("Supprimer définitivement cet enrollement ?")) return;

    setBusyEnrollmentId(enrollmentId);
    const res =
      action === "verify"
        ? await verifyEnrollmentPaymentByManagerAction(enrollmentId)
        : action === "manual"
          ? await manuallyConfirmEnrollmentByManagerAction(enrollmentId)
          : action === "mail"
            ? await resendEnrollmentEmailByManagerAction(enrollmentId)
            : await deleteEnrollmentByManagerAction(enrollmentId);

    if (res.success) {
      toast.success(res.message || "Action effectuée.");
      await reloadEnrolled();
    } else {
      toast.error(res.error || "Action impossible.");
    }
    setBusyEnrollmentId(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const formatCDF = (value?: number) => `${Math.floor(Number(value || 0)).toLocaleString("fr-FR")} FC`;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      CONFIRMED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return styles[status] || "bg-gray-100 text-gray-700";
  };

  const filteredEnrolled = enrolledList.filter((e) => {
    const pseudo = e.playerId?.userId?.pseudo || e.equipeId?.designation || "";
    return pseudo.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      {/* Step: Sessions List */}
      {step === "sessions" && (
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white">Gestion des enrollements</h2>
              <p className="text-sm text-waterloo">{sessions.length} session(s) active(s)</p>
            </div>
            <button
              onClick={() => { setEditSession(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
            >
              <Plus className="h-4 w-4" /> Nouvelle session
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-waterloo">Chargement...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Calendar className="h-12 w-12 text-waterloo/40" />
              <p className="mt-4 font-medium text-black dark:text-white">Aucune session</p>
              <p className="mt-1 text-sm text-waterloo">Créez une session pour commencer.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <motion.div
                  key={session._id}
                  whileHover={{ scale: 1.02 }}
                  className="cursor-pointer rounded-xl border border-stroke bg-white p-5 shadow-solid-5 transition hover:shadow-solid-7 dark:border-strokedark dark:bg-blacksection"
                  onClick={() => handleSelectSession(session)}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditSession(session); setShowModal(true); }}
                        className="rounded-lg p-1.5 text-waterloo hover:bg-stroke dark:hover:bg-strokedark"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteSession(session._id, e)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mb-2 font-semibold text-black dark:text-white">{session.designation}</h3>
                  <div className="flex items-center gap-2 text-xs text-waterloo">
                    <span>Du {formatDate(session.startDate)}</span>
                    <span>•</span>
                    <span>au {formatDate(session.endDate)}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                      {getSessionType(session) === "parcours" ? "Parcours" : "CompÃ©tition"}
                    </span>
                    <span className="rounded-full bg-stroke px-2.5 py-1 font-medium text-black dark:bg-strokedark dark:text-white">
                      {session.status || "ACTIVE"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {getStatusWorkflow(session).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={(e) => handleUpdateStatus(session, status, e)}
                        disabled={(session.status || "ACTIVE") === status}
                        className="rounded-md border border-stroke px-2 py-1 text-[11px] font-medium text-waterloo transition hover:border-primary hover:text-primary disabled:cursor-default disabled:border-primary disabled:bg-primary/10 disabled:text-primary dark:border-strokedark"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                  {getSessionType(session) === "competition" && (
                    <div className="mt-4 rounded-lg border border-stroke bg-alabaster p-3 text-[11px] text-waterloo dark:border-strokedark dark:bg-strokedark">
                      <p className="mb-2 font-semibold text-black dark:text-white">Bourse d'Excellence Academique</p>
                      <div className="grid grid-cols-2 gap-2">
                        <span>Total encaisse CDF : {formatCDF(session.totalCollectedCDF)}</span>
                        <span>Part plateforme : {formatCDF(session.platformAmountCDF)}</span>
                        <span>Bourse initiale : {formatCDF(session.scholarshipInitialAmountCDF)}</span>
                        <span>Bourse distribuee : {formatCDF(session.scholarshipDistributedAmountCDF)}</span>
                        <span>Bourse restante : {formatCDF(session.scholarshipRemainingAmountCDF)}</span>
                        <span>Enrolements valides : {session.totalValidatedEnrollments || 0}</span>
                        <span>Parties accordees : {session.totalGrantedGames || 0}</span>
                        <span>Valeur partie gagnee : {formatCDF(session.unitRewardPerWonGameCDF)}</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Resources */}
      {step === "resources" && selectedSession && (
        <div>
          <button
            onClick={() => setStep("sessions")}
            className="mb-6 flex items-center gap-2 text-sm text-waterloo transition hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux sessions
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-white">{selectedSession.designation}</h2>
            <p className="text-sm text-waterloo">
              {formatDate(selectedSession.startDate)} — {formatDate(selectedSession.endDate)}
            </p>
          </div>

          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
            <BookOpen className="h-5 w-5 text-primary" /> Ressources liées à la session
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ressourcesLoading ? (
            <div className="flex flex-col items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-waterloo">Chargement...</p></div>
          ) : ressources.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <BookOpen className="h-12 w-12 text-waterloo/40" />
              <p className="mt-4 font-medium text-black dark:text-white">Aucune ressource liée</p>
              <p className="mt-1 text-sm text-waterloo">Associez des parcours ou compétitions à cette session.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ressources.map((res) => (
                <motion.button key={res.refId}
                  whileHover={{ scale: 1.01 }}
                  onClick={() => handleSelectRessource(res.type, res.refId, res.name)}
                  className="flex items-center gap-4 rounded-xl border border-stroke bg-white p-4 text-left shadow-solid-5 transition hover:border-primary dark:border-strokedark dark:bg-blacksection"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-black dark:text-white">{res.name}</p>
                    <p className="text-xs text-waterloo">{res.type === "Parcours" ? "Parcours" : "Compétition"}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-waterloo" />
                </motion.button>
              ))}
            </div>
          )}
          </div>
        </div>
      )}

      {/* Step: Enrolled List */}
      {step === "enrolled" && (
        <div>
          <button
            onClick={() => setStep("resources")}
            className="mb-6 flex items-center gap-2 text-sm text-waterloo transition hover:text-black dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Retour aux ressources
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-white">
              Inscrits — {selectedSession?.designation}
            </h2>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par pseudo ou équipe..."
                className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-10 pr-4 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
          </div>

          {enrolledLoading ? (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm text-waterloo">Chargement des enrollements...</p>
            </div>
          ) : filteredEnrolled.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Users className="h-12 w-12 text-waterloo/40" />
              <p className="mt-4 font-medium text-black dark:text-white">Aucun inscrit</p>
              <p className="mt-1 text-sm text-waterloo">
                {search ? "Aucun résultat pour cette recherche." : "Aucune inscription pour cette ressource."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEnrolled.map((enr) => (
                <div
                  key={enr._id}
                  className="flex items-center gap-4 rounded-xl border border-stroke bg-white p-4 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {enr.playerId ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      <Users className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-black dark:text-white truncate">
                      {enr.playerId?.userId?.pseudo || enr.equipeId?.designation || "—"}
                    </p>
                    <p className="text-xs text-waterloo">
                      {enr.playerId ? `Joueur · ${enr.playerId.userId?.telephone || ""}` : `Équipe · ${enr.code}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(enr.status)}`}>
                      {enr.status === "CONFIRMED" ? "Confirmé" : enr.status === "PENDING" ? "En attente" : "Annulé"}
                    </span>
                    <p className="mt-1 text-xs text-waterloo">{enr.remainingGames ?? enr.parties} partie(s)</p>
                    {selectedRessource?.type === "Competition" && (
                      <div className="mt-2 space-y-0.5 text-xs text-waterloo">
                        <p>PayÃ© : {(enr.transactions?.[0]?.montant || 0).toLocaleString("fr-FR")} {enr.transactions?.[0]?.currency || "CDF"}</p>
                        <p>RÃ©f. CDF Bourse : {formatCDF(selectedSession?.enrollmentFeeCDF)}</p>
                        <p>Contribution Bourse : {formatCDF((selectedSession?.enrollmentFeeCDF || 0) * 0.65)}</p>
                        <p>Contribution plateforme : {formatCDF((selectedSession?.enrollmentFeeCDF || 0) * 0.35)}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleEnrollmentAction(enr._id, "verify")}
                      disabled={busyEnrollmentId === enr._id || !enr.orderNumber}
                      className="inline-flex items-center gap-1 rounded-lg border border-stroke px-2.5 py-1.5 text-xs font-medium text-black transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-strokedark dark:text-white"
                    >
                      {busyEnrollmentId === enr._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Vérifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnrollmentAction(enr._id, "manual")}
                      disabled={busyEnrollmentId === enr._id || enr.status === "CONFIRMED"}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Valider
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnrollmentAction(enr._id, "mail")}
                      disabled={busyEnrollmentId === enr._id}
                      className="inline-flex items-center gap-1 rounded-lg border border-stroke px-2.5 py-1.5 text-xs font-medium text-black transition hover:border-primary hover:text-primary disabled:opacity-50 dark:border-strokedark dark:text-white"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Mail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnrollmentAction(enr._id, "delete")}
                      disabled={busyEnrollmentId === enr._id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Session Modal */}
      <AnimatePresence>
        {showModal && (
          <SessionModal
            mode={editSession ? "edit" : "create"}
            session={editSession}
            onClose={() => { setShowModal(false); setEditSession(null); }}
            onSaved={() => { fetchSessions(); setShowModal(false); setEditSession(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
