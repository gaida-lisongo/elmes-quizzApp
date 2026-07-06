"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, Plus, X, Trash2, Edit3, Loader2,
  Users, CheckCircle, AlertCircle, ChevronRight,
  ArrowLeft, Search, BookOpen, FileText,
} from "lucide-react";
import {
  getActiveSessionsAction, getAllSessionsAction,
  createSessionAction, updateSessionAction, deleteSessionAction,
} from "@/actions/enrollment.actions";

/* ================================================================
   Types
   ================================================================ */
interface SessionItem {
  _id: string;
  slug: string;
  designation: string;
  startDate: string;
  endDate: string;
}

interface EnrolledItem {
  _id: string;
  playerId?: { _id: string; userId?: { pseudo: string; telephone: string } };
  equipeId?: { _id: string; designation: string };
  code: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED";
  parties: number;
  createdAt: string;
}

type Step = "sessions" | "resources" | "enrolled";

/* ================================================================
   Modal Session (Create / Edit)
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
  const [form, setForm] = useState({
    designation: session?.designation || "",
    startDate: session?.startDate?.split("T")[0] || "",
    endDate: session?.endDate?.split("T")[0] || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.designation || !form.startDate || !form.endDate) {
        throw new Error("Tous les champs sont obligatoires.");
      }
      if (new Date(form.endDate) <= new Date(form.startDate)) {
        throw new Error("La date de fin doit être après la date de début.");
      }

      let res;
      if (mode === "create") {
        res = await createSessionAction(form);
      } else if (session) {
        res = await updateSessionAction(session._id, form);
      }

      if (!res?.success) throw new Error(res?.error || "Erreur lors de l'enregistrement");

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-black dark:text-white">
            <Calendar className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nouvelle session" : "Modifier la session"}
          </h3>
          <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Désignation</label>
            <input
              type="text"
              value={form.designation}
              onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
              placeholder="Ex: Session Juillet 2026"
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Date début</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Date fin</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:opacity-50"
          >
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Création...</> : mode === "create" ? "Créer" : "Enregistrer"}
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
  const [showModal, setShowModal] = useState(false);
  const [editSession, setEditSession] = useState<SessionItem | null>(null);
  const [search, setSearch] = useState("");

  // Mock resources for demo
  const resources = [
    { id: "1", name: "Mathématiques", count: 12 },
    { id: "2", name: "Français", count: 8 },
    { id: "3", name: "Culture générale", count: 15 },
    { id: "4", name: "Histoire", count: 6 },
  ];

  // Mock enrolled for demo
  const enrolledList: EnrolledItem[] = [
    {
      _id: "1", code: "ENR-001", status: "CONFIRMED", parties: 5,
      playerId: { _id: "p1", userId: { pseudo: "Nathan", telephone: "+243853102426" } },
      createdAt: new Date().toISOString(),
    },
    {
      _id: "2", code: "ENR-002", status: "PENDING", parties: 0,
      equipeId: { _id: "e1", designation: "Les Génies" },
      createdAt: new Date().toISOString(),
    },
    {
      _id: "3", code: "ENR-003", status: "CONFIRMED", parties: 3,
      playerId: { _id: "p2", userId: { pseudo: "Marie", telephone: "+243812345678" } },
      createdAt: new Date().toISOString(),
    },
    {
      _id: "4", code: "ENR-004", status: "CANCELLED", parties: 0,
      equipeId: { _id: "e2", designation: "Elite Squad" },
      createdAt: new Date().toISOString(),
    },
  ];

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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

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
                  className="group cursor-pointer rounded-xl border border-stroke bg-white p-5 shadow-solid-5 transition hover:shadow-solid-7 dark:border-strokedark dark:bg-blacksection"
                  onClick={() => { setSelectedSession(session); setStep("resources"); }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
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
            {resources.map((res) => (
              <motion.button
                key={res.id}
                whileHover={{ scale: 1.01 }}
                onClick={() => setStep("enrolled")}
                className="flex items-center gap-4 rounded-xl border border-stroke bg-white p-4 text-left shadow-solid-5 transition hover:border-primary dark:border-strokedark dark:bg-blacksection"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-black dark:text-white">{res.name}</p>
                  <p className="text-xs text-waterloo">{res.count} inscrit(s)</p>
                </div>
                <ChevronRight className="h-5 w-5 text-waterloo" />
              </motion.button>
            ))}
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

          {filteredEnrolled.length === 0 ? (
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
                    <p className="mt-1 text-xs text-waterloo">{enr.parties} partie(s)</p>
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