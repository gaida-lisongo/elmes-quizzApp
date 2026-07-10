"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Plus, Loader2, CheckCircle, XCircle, AlertCircle, Pencil, Trash2, X, Save,
} from "lucide-react";
import {
  getCriteresAction,
  createCritereAction,
  updateCritereAction,
  deleteCritereAction,
} from "@/actions/critere.actions";
import { getAllSessionsAction } from "@/actions/enrollment.actions";
import toast from "react-hot-toast";

interface CritereItem {
  _id: string;
  sessionId?: { _id: string; designation: string };
  designation: string;
  description: string;
  firstRecompense: number;
  secondRecompense: number;
  thirdRecompense: number;
  status: boolean;
}

type FormMode = "create" | "edit";

const emptyForm = {
  sessionId: "",
  designation: "",
  description: "",
  firstRecompense: "",
  secondRecompense: "",
  thirdRecompense: "",
};

export default function CriteresAdmin() {
  const [criteres, setCriteres] = useState<CritereItem[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [cRes, sRes] = await Promise.all([
      getCriteresAction(),
      getAllSessionsAction(),
    ]);
    if (cRes.success) setCriteres(cRes.criteres || []);
    if (sRes.success) setSessions(sRes.sessions || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setFormMode("create");
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (critere: CritereItem) => {
    setForm({
      sessionId: critere.sessionId?._id || "",
      designation: critere.designation,
      description: critere.description || "",
      firstRecompense: String(critere.firstRecompense || ""),
      secondRecompense: String(critere.secondRecompense || ""),
      thirdRecompense: String(critere.thirdRecompense || ""),
    });
    setFormMode("edit");
    setEditingId(critere._id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (formMode === "create") {
        const res = await createCritereAction(form);
        if (res.success) {
          toast.success("Critère créé !");
          resetForm();
          await load();
        } else {
          toast.error(res.error || "Erreur");
        }
      } else if (editingId) {
        const res = await updateCritereAction(editingId, {
          designation: form.designation,
          description: form.description,
          firstRecompense: Number(form.firstRecompense) || 0,
          secondRecompense: Number(form.secondRecompense) || 0,
          thirdRecompense: Number(form.thirdRecompense) || 0,
        });
        if (res.success) {
          toast.success("Critère modifié !");
          resetForm();
          await load();
        } else {
          toast.error(res.error || "Erreur");
        }
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (critere: CritereItem) => {
    const res = await updateCritereAction(critere._id, { status: !critere.status });
    if (res.success) {
      toast.success(critere.status ? "Critère désactivé." : "Critère activé.");
      await load();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer définitivement ce critère ?")) return;
    const res = await deleteCritereAction(id);
    if (res.success) {
      toast.success("Critère supprimé.");
      if (editingId === id) resetForm();
      await load();
    } else {
      toast.error(res.error || "Erreur");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">Critères de récompense</h2>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primaryho"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Fermer" : "Nouveau"}
        </button>
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
        >
          <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
            {formMode === "create" ? "Nouveau critère" : "Modifier le critère"}
          </h3>

          <div className="space-y-4">
            {/* Session + Désignation */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Session</label>
                <select
                  value={form.sessionId}
                  onChange={(e) => setForm({ ...form, sessionId: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  required
                >
                  <option value="">Sélectionner une session…</option>
                  {sessions.map((s: any) => (
                    <option key={s._id} value={s._id}>{s.designation}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Désignation</label>
                <input
                  type="text"
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  required
                  placeholder="Ex: Phase 1"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
                placeholder="Description optionnelle"
              />
            </div>

            {/* Récompenses — 3 colonnes */}
            <div>
              <p className="mb-3 text-sm font-medium text-black dark:text-white">Récompenses (en USD)</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-500/20 dark:bg-amber-900/10">
                  <p className="mb-2 text-xs font-semibold uppercase text-amber-600 dark:text-amber-400">3e place</p>
                  <input
                    type="number"
                    min={0}
                    placeholder="Montant $"
                    value={form.thirdRecompense}
                    onChange={(e) => setForm({ ...form, thirdRecompense: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-blacksection dark:text-white"
                  />
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-500/20 dark:bg-purple-900/10">
                  <p className="mb-2 text-xs font-semibold uppercase text-purple-600 dark:text-purple-400">2e place</p>
                  <input
                    type="number"
                    min={0}
                    placeholder="Montant $"
                    value={form.secondRecompense}
                    onChange={(e) => setForm({ ...form, secondRecompense: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-blacksection dark:text-white"
                  />
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                  <p className="mb-2 text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400">1re place</p>
                  <input
                    type="number"
                    min={0}
                    placeholder="Montant $"
                    value={form.firstRecompense}
                    onChange={(e) => setForm({ ...form, firstRecompense: e.target.value })}
                    className="w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-strokedark dark:bg-blacksection dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primaryho disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {formMode === "create" ? "Créer le critère" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-stroke px-4 py-2.5 text-sm font-medium text-black dark:border-strokedark dark:text-white"
              >
                Annuler
              </button>
            </div>
          </div>
        </motion.form>
      )}

      {/* Liste des critères */}
      <div className="grid gap-4">
        {criteres.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-white p-10 text-center text-waterloo dark:border-strokedark dark:bg-blacksection">
            Aucun critère défini.
          </div>
        ) : (
          criteres.map((c) => (
            <div
              key={c._id}
              className={`rounded-2xl border p-5 shadow-solid-5 transition ${
                c.status
                  ? "border-stroke bg-white dark:border-strokedark dark:bg-blacksection"
                  : "border-stroke bg-gray-50 opacity-70 dark:border-strokedark dark:bg-blacksection"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-black dark:text-white">{c.designation}</h3>
                  <p className="text-xs text-waterloo">
                    {(c.sessionId as any)?.designation || "Session"} • {c.description || "Aucune description"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      c.status
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {c.status ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {c.status ? "Actif" : "Inactif"}
                  </span>
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg border border-stroke p-1.5 text-waterloo hover:border-primary hover:text-primary dark:border-strokedark"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c._id)}
                    className="rounded-lg border border-stroke p-1.5 text-waterloo hover:border-red-400 hover:text-red-500 dark:border-strokedark"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Récompenses */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/20 dark:bg-amber-900/10">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">3e place</p>
                  <p className="mt-1 text-lg font-bold text-black dark:text-white">
                    {c.thirdRecompense ? `${c.thirdRecompense.toLocaleString("fr-FR")} $` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-500/20 dark:bg-purple-900/10">
                  <p className="text-xs font-medium text-purple-600 dark:text-purple-400">2e place</p>
                  <p className="mt-1 text-lg font-bold text-black dark:text-white">
                    {c.secondRecompense ? `${c.secondRecompense.toLocaleString("fr-FR")} $` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                  <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">1re place</p>
                  <p className="mt-1 text-lg font-bold text-black dark:text-white">
                    {c.firstRecompense ? `${c.firstRecompense.toLocaleString("fr-FR")} $` : "—"}
                  </p>
                </div>
              </div>

              {/* Bouton basculer statut */}
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => handleToggleStatus(c)}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    c.status
                      ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400"
                      : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400"
                  }`}
                >
                  {c.status ? "Désactiver" : "Activer"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}