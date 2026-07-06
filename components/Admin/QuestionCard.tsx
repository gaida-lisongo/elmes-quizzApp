"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Trash2, Edit3, Loader2, Search,
  CheckCircle, AlertCircle, ChevronRight, Upload,
  FileUp, Eye,
} from "lucide-react";
import {
  createQuizAction, updateQuizAction, deleteQuizAction,
} from "@/actions/quiz.actions";
import QuestionPreview from "./QuestionPreview";

/* ================================================================
   Types
   ================================================================ */
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

interface QuestionCardProps {
  categorieId: string;
  quizzes: QuizItem[];
  filteredQuizzes: QuizItem[];
  levelFilter: number | null;
  setLevelFilter: (v: number | null) => void;
  quizSearch: string;
  setQuizSearch: (v: string) => void;
  onRefresh: () => Promise<void>;
  onOpenCsv: () => void;
}

const LEVELS = [
  { value: 0, label: "Niveau 0" },
  { value: 1, label: "Niveau 1" },
  { value: 2, label: "Niveau 2" },
  { value: 3, label: "Niveau 3" },
];

/* ================================================================
   QuestionEditor Modal (Create / Edit)
   ================================================================ */
const QuestionEditor = ({
  mode,
  quiz,
  categorieId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  quiz?: QuizItem | null;
  categorieId: string;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [enonce, setEnonce] = useState(quiz?.enonce || "");
  const [type, setType] = useState<"QCM" | "VRAI_FAUX">(quiz?.type || "QCM");
  const [assertions, setAssertions] = useState<string[]>(quiz?.assertions || ["", "", "", ""]);
  const [reponse, setReponse] = useState(quiz?.reponse || "");
  const [level, setLevel] = useState(quiz?.level ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!enonce.trim()) throw new Error("L'énoncé est obligatoire.");
      const cleanAssertions = type === "VRAI_FAUX" ? ["Vrai", "Faux"] : assertions.filter(a => a.trim());
      if (cleanAssertions.length < 2) throw new Error("Au moins 2 assertions requises.");
      if (!reponse.trim()) throw new Error("La réponse correcte est obligatoire.");

      let res;
      if (mode === "create") {
        res = await createQuizAction({ categorieId, enonce: enonce.trim(), assertions: cleanAssertions, reponse: reponse.trim(), level: level as 0 | 1 | 2 | 3, type });
      } else if (quiz) {
        res = await updateQuizAction(quiz._id, { enonce: enonce.trim(), assertions: cleanAssertions, reponse: reponse.trim(), level: level as 0 | 1 | 2 | 3, type });
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
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection" onClick={(e) => e.stopPropagation()}>
        
        <div className="mb-6 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-black dark:text-white">
            <Edit3 className="h-5 w-5 text-primary" />
            {mode === "create" ? "Nouvelle question" : "Modifier la question"}
          </h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 text-xs text-waterloo transition hover:bg-stroke dark:border-strokedark dark:hover:bg-strokedark">
              <Eye className="h-3.5 w-3.5" /> {showPreview ? "Éditer" : "Aperçu"}
            </button>
            <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {showPreview ? (
          <div className="rounded-xl border border-stroke bg-alabaster p-6 dark:border-strokedark dark:bg-strokedark">
            <QuestionPreview enonce={enonce} reponse={reponse} assertions={assertions} type={type} level={level} />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Type & Level row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value as "QCM" | "VRAI_FAUX")}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white">
                  <option value="QCM">QCM</option>
                  <option value="VRAI_FAUX">Vrai / Faux</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Niveau</label>
                <select value={level} onChange={(e) => setLevel(Number(e.target.value))}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white">
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>

            {/* Énoncé */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Énoncé (support LaTeX avec $$)</label>
              <textarea value={enonce} onChange={(e) => setEnonce(e.target.value)} rows={4}
                placeholder="$$E = mc^2$$ ou texte simple..."
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2.5 text-sm text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white font-mono" />
            </div>

            {/* Assertions */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Propositions</label>
              {type === "VRAI_FAUX" ? (
                <div className="flex gap-4 text-sm text-waterloo">
                  <span className="rounded-lg border border-stroke px-4 py-2 dark:border-strokedark">Vrai</span>
                  <span className="rounded-lg border border-stroke px-4 py-2 dark:border-strokedark">Faux</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {assertions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="text" value={a} onChange={(e) => {
                        const newA = [...assertions];
                        newA[i] = e.target.value;
                        setAssertions(newA);
                      }} placeholder={`Proposition ${i + 1}`}
                        className="flex-1 rounded-lg border border-stroke bg-transparent px-4 py-2 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white" />
                      <button onClick={() => {
                        const newA = assertions.filter((_, idx) => idx !== i);
                        setAssertions(newA);
                      }} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button onClick={() => setAssertions([...assertions, ""])}
                    className="text-xs text-primary hover:underline">+ Ajouter une proposition</button>
                </div>
              )}
            </div>

            {/* Bonne réponse */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Bonne réponse</label>
              <div className="flex flex-wrap gap-2">
                {(type === "VRAI_FAUX" ? ["Vrai", "Faux"] : assertions.filter(a => a.trim())).map((a) => (
                  <button key={a} onClick={() => setReponse(a)}
                    className={`rounded-lg border px-4 py-2 text-sm transition ${
                      reponse === a
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-stroke text-waterloo hover:border-primary dark:border-strokedark"
                    }`}>
                    {reponse === a && <CheckCircle className="mr-1 inline h-3.5 w-3.5" />}
                    {a || "(vide)"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
   QuestionCard Principal
   ================================================================ */
export default function QuestionCard({
  categorieId, quizzes, filteredQuizzes, levelFilter, setLevelFilter, quizSearch, setQuizSearch, onRefresh, onOpenCsv,
}: QuestionCardProps) {
  const [editQuiz, setEditQuiz] = useState<QuizItem | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleDeleteQuiz = async (id: string) => {
    if (!confirm("Supprimer cette question ?")) return;
    const res = await deleteQuizAction(id);
    if (res.success) onRefresh();
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar niveaux */}
      <div className="hidden w-48 shrink-0 lg:block">
        <div className="sticky top-28 rounded-xl border border-stroke bg-white p-4 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
          <h4 className="mb-3 text-sm font-semibold text-black dark:text-white">Niveaux</h4>
          <div className="space-y-1">
            <button onClick={() => setLevelFilter(null)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                levelFilter === null ? "bg-primary text-white" : "text-waterloo hover:bg-stroke dark:hover:bg-strokedark"
              }`}>Tous ({quizzes.length})</button>
            {LEVELS.map(l => {
              const count = quizzes.filter(q => q.level === l.value).length;
              return (
                <button key={l.value} onClick={() => setLevelFilter(l.value)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    levelFilter === l.value ? "bg-primary text-white" : "text-waterloo hover:bg-stroke dark:hover:bg-strokedark"
                  }`}>
                  {l.label} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 min-w-0">
        {/* Barre d'outils */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
            <input type="text" value={quizSearch} onChange={(e) => setQuizSearch(e.target.value)}
              placeholder="Rechercher..." className="w-full rounded-lg border border-stroke bg-transparent py-2 pl-10 pr-4 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={onOpenCsv}
              className="flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm text-waterloo transition hover:bg-stroke dark:border-strokedark dark:hover:bg-strokedark">
              <FileUp className="h-4 w-4" /> Import CSV
            </button>
            <button onClick={() => { setEditQuiz(null); setShowEditor(true); }}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white transition hover:bg-primaryho">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>
        </div>

        {/* Grille de questions */}
        {filteredQuizzes.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Edit3 className="h-10 w-10 text-waterloo/40" />
            <p className="mt-3 font-medium text-black dark:text-white">Aucune question</p>
            <p className="mt-1 text-sm text-waterloo">Ajoutez votre première question.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredQuizzes.map((quiz) => (
              <motion.div key={quiz._id} layout
                className="group relative rounded-xl border border-stroke bg-white p-4 shadow-solid-5 transition hover:shadow-solid-7 dark:border-strokedark dark:bg-blacksection">
                {/* Actions */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => { setEditQuiz(quiz); setShowEditor(true); }}
                    className="rounded-lg p-1 text-waterloo hover:bg-stroke dark:hover:bg-strokedark"><Edit3 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDeleteQuiz(quiz._id)}
                    className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>

                {/* Niveau badge */}
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Niv. {quiz.level}
                  </span>
                  <span className="rounded-full bg-alabaster px-2 py-0.5 text-[10px] text-waterloo dark:bg-strokedark">
                    {quiz.type}
                  </span>
                </div>

                {/* Énoncé */}
                <div className="mb-3 text-sm text-black dark:text-white line-clamp-3">
                  <QuestionPreview enonce={quiz.enonce} reponse="" assertions={[]} type={quiz.type} level={quiz.level} mini />
                </div>

                {/* Propositions */}
                <div className="space-y-1">
                  {quiz.assertions.map((a, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs ${
                      a === quiz.reponse
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : "text-waterloo"
                    }`}>
                      {a === quiz.reponse && <CheckCircle className="h-3 w-3 shrink-0 text-green-500" />}
                      <span className="line-clamp-1">{a}</span>
                    </div>
                  ))}
                </div>

                {/* Statut */}
                <div className={`mt-2 text-[10px] ${quiz.status ? "text-green-500" : "text-red-500"}`}>
                  {quiz.status ? "Active" : "Inactive"}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Editor Modal */}
        <AnimatePresence>
          {showEditor && (
            <QuestionEditor
              mode={editQuiz ? "edit" : "create"}
              quiz={editQuiz}
              categorieId={categorieId}
              onClose={() => { setShowEditor(false); setEditQuiz(null); }}
              onSaved={() => { onRefresh(); setShowEditor(false); setEditQuiz(null); }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}