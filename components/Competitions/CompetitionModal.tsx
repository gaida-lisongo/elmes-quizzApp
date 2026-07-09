"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "@/components/Common/ImageUploader";
import {
  createCompetition,
  updateCompetition,
  deleteCompetition,
} from "@/actions/competitions.actions";
import { getCategoriesForForm } from "@/actions/parcours.actions";

interface CategorieItem {
  _id: string;
  designation: string;
  slug: string;
}

interface CompetitionItem {
  _id: string;
  designation: string;
  description: string;
  ressources?: string;
  cagnotte: number;
  amount: number;
  categories: { _id: string; designation: string; slug: string }[];
  questions: number;
  image?: string;
  slug: string;
  status: string;
}

interface ModalState {
  open: boolean;
  mode: "create" | "edit";
  data: CompetitionItem | null;
}

const EMPTY_FORM = {
  designation: "",
  description: "",
  ressources: "",
  categories: [] as string[],
  questions: 1,
  cagnotte: 0,
  amount: 0,
  image: "",
  slug: "",
};

const CompetitionModal = ({
  modal,
  onClose,
  onSaved,
}: {
  modal: ModalState;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState<CategorieItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategoriesForForm().then((res) => {
      if (res.success) setCategories(res.categories);
    });
  }, []);

  useEffect(() => {
    if (modal.mode === "edit" && modal.data) {
      setForm({
        designation: modal.data.designation,
        description: modal.data.description || "",
        ressources: modal.data.ressources || "",
        categories: modal.data.categories?.map((c) => c._id) || [],
        questions: modal.data.questions,
        cagnotte: modal.data.cagnotte,
        amount: modal.data.amount,
        image: modal.data.image || "",
        slug: modal.data.slug,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setStep(1);
  }, [modal]);

  const updateField = (field: keyof typeof form, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "designation") {
      setForm((prev) => ({
        ...prev,
        designation: value,
        slug: value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      }));
    }
  };

  const toggleCategory = (catId: string) => {
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter((id) => id !== catId)
        : [...prev.categories, catId],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        designation: form.designation,
        description: form.description,
        ressources: form.ressources,
        categories: form.categories,
        questions: form.questions,
        cagnotte: form.cagnotte,
        amount: form.amount,
        image: form.image,
        slug: form.slug,
      };

      let result;
      if (modal.mode === "create") {
        result = await createCompetition(payload);
      } else {
        result = await updateCompetition(modal.data!._id, payload);
      }

      if (!result.success) throw new Error(result.error);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!modal.data || !confirm("Supprimer cette compétition ?")) return;
    setSaving(true);
    try {
      const result = await deleteCompetition(modal.data._id);
      if (!result.success) throw new Error(result.error);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {modal.open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-99999 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-solid-4 dark:bg-blacksection"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-black dark:text-white">
                {modal.mode === "create" ? "Nouvelle compétition" : "Modifier la compétition"}
              </h3>
              <button onClick={onClose} className="text-waterloo hover:text-black dark:hover:text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Stepper 3 étapes */}
            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      step === s
                        ? "bg-primary text-white"
                        : step > s
                        ? "bg-meta text-white"
                        : "bg-stroke text-manatee dark:bg-strokedark"
                    }`}
                  >
                    {s}
                  </div>
                  {s < 3 && (
                    <div className={`h-0.5 flex-1 ${step > s ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Étape 1 : Infos générales */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Titre</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) => updateField("designation", e.target.value)}
                    placeholder="Titre de la compétition"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Description de la compétition"
                    rows={4}
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Ressource de préparation</label>
                  <input
                    type="url"
                    value={form.ressources}
                    onChange={(e) => updateField("ressources", e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Questions</label>
                    <input
                      type="number"
                      min={1}
                      value={form.questions}
                      onChange={(e) => updateField("questions", parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Catégories</label>
                    <div className="flex h-[42px] items-center rounded-lg border border-stroke bg-transparent px-4 text-sm text-waterloo dark:border-strokedark">
                      {form.categories.length} sélectionnée(s)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Étape 2 : Cagnotte et inscription */}
            {step === 2 && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-black dark:text-white">💰 Finance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Cagnotte (F)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.cagnotte}
                      onChange={(e) => updateField("cagnotte", parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Inscription (F)</label>
                    <input
                      type="number"
                      min={0}
                      value={form.amount}
                      onChange={(e) => updateField("amount", parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Catégories associées</label>
                  {categories.length === 0 ? (
                    <p className="text-sm text-waterloo">Aucune catégorie disponible</p>
                  ) : (
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {categories.map((cat) => (
                        <label
                          key={cat._id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-stroke px-4 py-3 transition hover:bg-primary/5 dark:border-strokedark"
                        >
                          <input
                            type="checkbox"
                            checked={form.categories.includes(cat._id)}
                            onChange={() => toggleCategory(cat._id)}
                            className="h-4 w-4 accent-primary"
                          />
                          <span className="text-sm text-black dark:text-white">{cat.designation}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Étape 3 : Image */}
            {step === 3 && (
              <div className="space-y-4">
                <ImageUploader
                  label="Image de la compétition"
                  currentImage={form.image}
                  onUploadComplete={(url) => updateField("image", url)}
                />
                {form.image && <p className="text-xs text-green-600">✓ Image uploadée</p>}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">Slug</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    placeholder="slug-de-la-competition"
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

            {/* Actions */}
            <div className="mt-6 flex justify-between">
              <div>
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
                  >
                    ← Retour
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                {modal.mode === "edit" && step === 3 && (
                  <button
                    onClick={handleDelete}
                    disabled={saving}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
                >
                  Annuler
                </button>
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 && (!form.designation || !form.description)}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Suivant →
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.slug}
                    className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Enregistrement..." : modal.mode === "create" ? "Créer" : "Enregistrer"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompetitionModal;
