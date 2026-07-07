"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Plus, X, Trash2, Edit3, Loader2, Layers,
  CheckCircle, AlertCircle, ChevronRight, ArrowLeft, Search,
  FileText, Upload,
} from "lucide-react";
import {
  getCategoriesAction, createCategorieAction, updateCategorieAction, deleteCategorieAction,
  getQuizzesByCategorieAction, createQuizAction, updateQuizAction, deleteQuizAction,
} from "@/actions/quiz.actions";
import { getCategoryStatsAction } from "@/actions/critere.actions";
import QuestionCard from "./QuestionCard";
import CsvWrapper from "./CsvWrapper";

/* ================================================================
   Types
   ================================================================ */
interface CategorieItem {
  _id: string;
  designation: string;
  description?: string;
  slug: string;
  status: boolean;
}

interface QuizItem {
  _id: string;
  categorieId: string;
  enonce: string;
  assertions: string[];
  reponse: string;
  level: number;
  status: boolean;
  type: "QCM" | "VRAI_FAUX";
}

type Step = "list" | "questions";

/* ================================================================
   Modal Catégorie
   ================================================================ */
const CategorieModal = ({
  mode,
  categorie,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  categorie?: CategorieItem | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState({
    designation: categorie?.designation || "",
    description: categorie?.description || "",
    slug: categorie?.slug || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugify = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.designation) throw new Error("La désignation est obligatoire.");
      const slug = form.slug || slugify(form.designation) + "-" + Date.now();
      let res;
      if (mode === "create") {
        res = await createCategorieAction({ ...form, slug });
      } else if (categorie) {
        res = await updateCategorieAction(categorie._id, { ...form, slug });
      }
      if (!res?.success) throw new Error(res?.error || "Erreur");
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
            <Layers className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nouvelle catégorie" : "Modifier la catégorie"}
          </h3>
          <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Désignation</label>
            <input type="text" value={form.designation}
              onChange={(e) => { const d = e.target.value; setForm(f => ({ ...f, designation: d, slug: mode === "create" ? slugify(d) : f.slug })); }}
              placeholder="Ex: Mathématiques" className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Description</label>
            <textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
          </div>
        </div>
        {error && <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:opacity-50">
            {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</> : mode === "create" ? "Créer" : "Enregistrer"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Composant QuestionsAdmin
   ================================================================ */
export default function QuestionsAdmin() {
  const [categories, setCategories] = useState<CategorieItem[]>([]);
  const [catStats, setCatStats] = useState<Record<string, { ok: number; no: number; total: number; percent: number }>>({});
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("list");
  const [selectedCat, setSelectedCat] = useState<CategorieItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<CategorieItem | null>(null);
  const [searchCat, setSearchCat] = useState("");

  // Questions sub-state
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState<number | null>(null);
  const [quizSearch, setQuizSearch] = useState("");
  const [showCsv, setShowCsv] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const [catRes, statsRes] = await Promise.all([
      getCategoriesAction(),
      getCategoryStatsAction(),
    ]);
    if (catRes.success) setCategories(catRes.categories);
    if (statsRes.success) {
      const map: Record<string, { ok: number; no: number; total: number; percent: number }> = {};
      for (const cat of (statsRes.categories || [])) {
        map[cat.label] = cat;
      }
      setCatStats(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDeleteCat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette catégorie et toutes ses questions ?")) return;
    const res = await deleteCategorieAction(id);
    if (res.success) fetchCategories();
  };

  const handleSelectCategorie = async (cat: CategorieItem) => {
    setSelectedCat(cat);
    setStep("questions");
    setQuizzesLoading(true);
    setLevelFilter(null);
    setQuizSearch("");
    const res = await getQuizzesByCategorieAction(cat._id);
    if (res.success) setQuizzes(res.quizzes);
    setQuizzesLoading(false);
  };

  const filteredQuizzes = quizzes.filter(q => {
    if (levelFilter !== null && q.level !== levelFilter) return false;
    if (quizSearch && !q.enonce.toLowerCase().includes(quizSearch.toLowerCase())) return false;
    return true;
  });

  const filteredCategories = categories.filter(c =>
    c.designation.toLowerCase().includes(searchCat.toLowerCase())
  );

  return (
    <div>
      {/* Step: Liste des catégories */}
      {step === "list" && (
        <div>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-black dark:text-white">Questions & Catégories</h2>
              <p className="text-sm text-waterloo">{categories.length} catégorie(s)</p>
            </div>
            <button onClick={() => { setEditCat(null); setShowModal(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho">
              <Plus className="h-4 w-4" /> Nouvelle catégorie
            </button>
          </div>

          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
              <input type="text" value={searchCat} onChange={(e) => setSearchCat(e.target.value)}
                placeholder="Rechercher une catégorie..." className="w-full rounded-lg border border-stroke bg-transparent py-2.5 pl-10 pr-4 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white" />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-waterloo">Chargement...</p></div>
          ) : filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <Layers className="h-12 w-12 text-waterloo/40" />
              <p className="mt-4 font-medium text-black dark:text-white">{searchCat ? "Aucun résultat" : "Aucune catégorie"}</p>
              {!searchCat && <p className="mt-1 text-sm text-waterloo">Créez votre première catégorie.</p>}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((cat) => (
                <motion.div key={cat._id} whileHover={{ scale: 1.02 }}
                  className="group cursor-pointer rounded-xl border border-stroke bg-white p-5 shadow-solid-5 transition hover:shadow-solid-7 dark:border-strokedark dark:bg-blacksection"
                  onClick={() => handleSelectCategorie(cat)}>
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); setEditCat(cat); setShowModal(true); }}
                        className="rounded-lg p-1.5 text-waterloo hover:bg-stroke dark:hover:bg-strokedark"><Edit3 className="h-4 w-4" /></button>
                      <button onClick={(e) => handleDeleteCat(cat._id, e)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <h3 className="mb-1 font-semibold text-black dark:text-white">{cat.designation}</h3>
                  {cat.description && <p className="text-xs text-waterloo line-clamp-2">{cat.description}</p>}
                  {/* Métrique de la catégorie */}
                  {catStats[cat.designation] && catStats[cat.designation].total > 0 && (
                    <div className="mt-2">
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${catStats[cat.designation].percent}%` }} />
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${100 - catStats[cat.designation].percent}%` }} />
                      </div>
                      <div className="mt-0.5 flex justify-between text-[10px] text-waterloo">
                        <span className="text-green-600">{catStats[cat.designation].ok} OK</span>
                        <span>{catStats[cat.designation].total} réponses</span>
                        <span className="text-red-500">{catStats[cat.designation].no} NO</span>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <span className={`inline-block rounded-full px-2 py-0.5 ${cat.status ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {cat.status ? "Active" : "Inactive"}
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 text-waterloo" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step: Questions de la catégorie */}
      {step === "questions" && selectedCat && (
        <div>
          <button onClick={() => setStep("list")}
            className="mb-6 flex items-center gap-2 text-sm text-waterloo transition hover:text-black dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Retour aux catégories
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-black dark:text-white">{selectedCat.designation}</h2>
            {selectedCat.description && <p className="text-sm text-waterloo">{selectedCat.description}</p>}
          </div>

          <QuestionCard
            categorieId={selectedCat._id}
            quizzes={quizzes}
            filteredQuizzes={filteredQuizzes}
            levelFilter={levelFilter}
            setLevelFilter={setLevelFilter}
            quizSearch={quizSearch}
            setQuizSearch={setQuizSearch}
            onRefresh={async () => {
              const res = await getQuizzesByCategorieAction(selectedCat._id);
              if (res.success) setQuizzes(res.quizzes);
            }}
            onOpenCsv={() => setShowCsv(true)}
          />

          {/* CSV Wrapper */}
          <AnimatePresence>
            {showCsv && (
              <CsvWrapper
                categorieId={selectedCat._id}
                onClose={() => setShowCsv(false)}
                onComplete={async () => {
                  const res = await getQuizzesByCategorieAction(selectedCat._id);
                  if (res.success) setQuizzes(res.quizzes);
                  setShowCsv(false);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <CategorieModal
            mode={editCat ? "edit" : "create"}
            categorie={editCat}
            onClose={() => { setShowModal(false); setEditCat(null); }}
            onSaved={() => { fetchCategories(); setShowModal(false); setEditCat(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}