"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Plus, Loader2, CheckCircle, XCircle, AlertCircle, ChevronDown,
} from "lucide-react";
import { getCriteresAction, createCritereAction, checkCriteresClassementAction } from "@/actions/critere.actions";
import toast from "react-hot-toast";

interface CritereItem {
  _id: string;
  ressource: string;
  designation: string;
  description: string;
  ressourceId: { _id: string; designation: string; slug: string };
  first: { points: number; recompense: string; playerId?: string; equipeId?: string }[];
  second: { points: number; recompense: string; playerId?: string; equipeId?: string }[];
  third: { points: number; recompense: string; playerId?: string; equipeId?: string }[];
  status: boolean;
}

export default function CriteresAdmin() {
  const [criteres, setCriteres] = useState<CritereItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [form, setForm] = useState({
    ressource: 'Competition' as 'Parcours' | 'Competition',
    ressourceId: '',
    designation: '',
    description: '',
    firstPoints: 0,
    secondPoints: 0,
    thirdPoints: 0,
    firstRecompense: '',
    secondRecompense: '',
    thirdRecompense: '',
  });

  const load = async () => {
    setLoading(true);
    const res = await getCriteresAction();
    if (res.success) setCriteres(res.criteres || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createCritereAction(form);
      if (res.success) {
        toast.success("Critère créé !");
        setShowForm(false);
        setForm({ ressource: 'Competition', ressourceId: '', designation: '', description: '', firstPoints: 0, secondPoints: 0, thirdPoints: 0, firstRecompense: '', secondRecompense: '', thirdRecompense: '' });
        await load();
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    }
  };

  const handleCheck = async (id: string) => {
    setChecking(id);
    try {
      const res = await checkCriteresClassementAction(id);
      if (res.success) {
        toast.success("Classement mis à jour !");
        await load();
      } else {
        toast.error(res.error || "Erreur");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setChecking(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">Critères de classement</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primaryho">
          <Plus className="h-4 w-4" /> {showForm ? "Fermer" : "Nouveau"}
        </button>
      </div>

      {showForm && (
        <motion.form initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleCreate} className="rounded-2xl border border-stroke bg-white p-6 space-y-4 dark:border-strokedark dark:bg-blacksection">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select value={form.ressource} onChange={(e) => setForm({ ...form, ressource: e.target.value as any })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm dark:border-strokedark dark:text-white">
                <option value="Competition">Compétition</option>
                <option value="Parcours">Parcours</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Désignation</label>
              <input type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm dark:border-strokedark dark:text-white" required />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm dark:border-strokedark dark:text-white" rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border border-amber-200 p-3 dark:border-amber-500/20">
              <p className="mb-2 text-xs font-medium text-amber-600">3e place (×6)</p>
              <input type="number" placeholder="Points" value={form.thirdPoints} onChange={(e) => setForm({ ...form, thirdPoints: +e.target.value })}
                className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
              <input type="text" placeholder="Récompense" value={form.thirdRecompense} onChange={(e) => setForm({ ...form, thirdRecompense: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
            </div>
            <div className="rounded-lg border border-purple-200 p-3 dark:border-purple-500/20">
              <p className="mb-2 text-xs font-medium text-purple-600">2e place (×4 → ×2)</p>
              <input type="number" placeholder="Points" value={form.secondPoints} onChange={(e) => setForm({ ...form, secondPoints: +e.target.value })}
                className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
              <input type="text" placeholder="Récompense" value={form.secondRecompense} onChange={(e) => setForm({ ...form, secondRecompense: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
            </div>
            <div className="rounded-lg border border-emerald-200 p-3 dark:border-emerald-500/20">
              <p className="mb-2 text-xs font-medium text-emerald-600">1re place (×2)</p>
              <input type="number" placeholder="Points" value={form.firstPoints} onChange={(e) => setForm({ ...form, firstPoints: +e.target.value })}
                className="mb-2 w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
              <input type="text" placeholder="Récompense" value={form.firstRecompense} onChange={(e) => setForm({ ...form, firstRecompense: e.target.value })}
                className="w-full rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-sm dark:border-strokedark" />
            </div>
          </div>
          <button type="submit" className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primaryho">Créer le critère</button>
        </motion.form>
      )}

      <div className="grid gap-4">
        {criteres.length === 0 ? (
          <div className="rounded-2xl border border-stroke bg-white p-10 text-center text-waterloo dark:border-strokedark dark:bg-blacksection">
            Aucun critère défini.
          </div>
        ) : criteres.map((c) => (
          <div key={c._id} className="rounded-2xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-black dark:text-white">{c.designation}</h3>
                <p className="text-xs text-waterloo">{(c.ressourceId as any)?.designation || c.ressource} • {c.status ? 'Actif' : 'Inactif'}</p>
              </div>
              <button onClick={() => handleCheck(c._id)} disabled={checking === c._id || !c.status}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-40">
                {checking === c._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                Vérifier classement
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 text-xs dark:border-amber-500/20 dark:bg-amber-900/10">
                <p className="font-medium text-amber-700 dark:text-amber-400">3e ({c.third[0]?.points || 0}pts)</p>
                <p className="text-waterloo">{c.third.filter(e => e.playerId || e.equipeId).length}/6 qualifié(s)</p>
              </div>
              <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2 text-xs dark:border-purple-500/20 dark:bg-purple-900/10">
                <p className="font-medium text-purple-700 dark:text-purple-400">2e ({c.second[0]?.points || 0}pts)</p>
                <p className="text-waterloo">{c.second.filter(e => e.playerId || e.equipeId).length}/4 qualifié(s)</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-xs dark:border-emerald-500/20 dark:bg-emerald-900/10">
                <p className="font-medium text-emerald-700 dark:text-emerald-400">1re ({c.first[0]?.points || 0}pts)</p>
                <p className="text-waterloo">{c.first.filter(e => e.playerId || e.equipeId).length}/2 qualifié(s)</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}