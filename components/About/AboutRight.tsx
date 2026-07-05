"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import ImageUploader from "@/components/Common/ImageUploader";
import {
  addPromesse,
  updatePromesse,
  deletePromesse,
} from "@/actions/branding.actions";

/* ================================================================
   Types
   ================================================================ */
interface Promesse {
  title: string;
  description: string;
  cta: { url: string; label: string };
  imageUrl: string;
}

interface ModalState {
  open: boolean;
  mode: "create" | "edit";
  index: number | null;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  ctaUrl: "",
  ctaLabel: "",
  imageUrl: "",
};

/* ================================================================
   Sous-composant : Modal deux étapes
   ================================================================ */
const PromesseModal = ({
  mode,
  index,
  editData,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  index: number | null;
  editData?: Promesse | null;
  onClose: () => void;
  onSaved: (promesses: Promesse[]) => void;
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && editData) {
      setForm({
        title: editData.title,
        description: editData.description,
        ctaUrl: editData.cta.url,
        ctaLabel: editData.cta.label,
        imageUrl: editData.imageUrl,
      });
    }
  }, [mode, editData]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: form.title,
        description: form.description,
        ctaUrl: form.ctaUrl,
        ctaLabel: form.ctaLabel,
        imageUrl: form.imageUrl,
      };

      const result =
        mode === "create"
          ? await addPromesse(payload)
          : await updatePromesse(index!, payload);

      if (!result.success) {
        throw new Error(result.error);
      }

      onSaved(result.promesses);
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  return (
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
            {mode === "create" ? "Nouvelle promesse" : "Modifier la promesse"}
          </h3>
          <button
            onClick={onClose}
            className="text-waterloo hover:text-black dark:hover:text-white"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Indicateur d'étape */}
        <div className="mb-6 flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step === 1
                ? "bg-primary text-white"
                : "bg-meta text-white"
            }`}
          >
            1
          </div>
          <div
            className={`h-0.5 flex-1 ${
              step === 2 ? "bg-meta" : "bg-stroke dark:bg-strokedark"
            }`}
          />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step === 2
                ? "bg-primary text-white"
                : "bg-stroke text-manatee dark:bg-strokedark"
            }`}
          >
            2
          </div>
        </div>

        {/* Étape 1 : Infos */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Titre
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Titre de la promesse"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Description de la promesse"
                rows={4}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                  Texte du CTA
                </label>
                <input
                  type="text"
                  value={form.ctaLabel}
                  onChange={(e) => updateField("ctaLabel", e.target.value)}
                  placeholder="En savoir plus"
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                  Lien du CTA
                </label>
                <input
                  type="text"
                  value={form.ctaUrl}
                  onChange={(e) => updateField("ctaUrl", e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Étape 2 : Image */}
        {step === 2 && (
          <div className="space-y-4">
            <ImageUploader
              label="Image de la promesse"
              currentImage={form.imageUrl}
              onUploadComplete={(url) => updateField("imageUrl", url)}
            />
            {form.imageUrl && (
              <p className="text-xs text-green-600">✓ Image uploadée</p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <div>
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
              >
                ← Retour
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-stroke px-4 py-2 text-sm text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
            >
              Annuler
            </button>
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!form.title || !form.description}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
              >
                Suivant →
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || !form.imageUrl}
                className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Enregistrement..."
                  : mode === "create"
                  ? "Créer"
                  : "Enregistrer"}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ================================================================
   Composant principal AboutRight
   ================================================================ */
const AboutRight = ({
  isAdmin = false,
  promesses = [],
}: {
  isAdmin?: boolean;
  promesses?: Promesse[];
}) => {
  const [items, setItems] = useState<Promesse[]>(promesses);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    index: null,
  });
  const [editTarget, setEditTarget] = useState<Promesse | null>(null);
  const [modalKey, setModalKey] = useState(0);

  // Met à jour les items quand les props changent
  useEffect(() => {
    setItems(promesses);
  }, [promesses]);

  // Cycle d'animation : 20 secondes par promesse
  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 20000);
    return () => clearInterval(interval);
  }, [items.length]);

  /* Handlers admin */
  const handleOpenCreate = () => {
    setEditTarget(null);
    setModal({ open: true, mode: "create", index: null });
    setModalKey((k) => k + 1);
  };

  const handleOpenEdit = (index: number) => {
    setEditTarget(items[index]);
    setModal({ open: true, mode: "edit", index });
    setModalKey((k) => k + 1);
  };

  const handleDelete = async (index: number) => {
    if (!confirm("Supprimer cette promesse ?")) return;
    const result = await deletePromesse(index);
    if (result.success) {
      setItems(result.promesses);
      if (currentIndex >= result.promesses.length) {
        setCurrentIndex(0);
      }
    }
  };

  const handleSaved = (updatedPromesses: Promesse[]) => {
    setItems(updatedPromesses);
    setCurrentIndex(0);
  };

  const current = items[currentIndex];

  return (
    <>
      <section>
        <div className="mx-auto max-w-c-1235 overflow-hidden px-4 md:px-8 2xl:px-0">
          <div className="flex items-center gap-8 lg:gap-32.5">
            {/* Partie texte */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0 },
              }}
              initial="hidden"
              whileInView="visible"
              transition={{ duration: 1, delay: 0.1 }}
              viewport={{ once: true }}
              className="animate_left md:w-1/2"
            >
              <span className="font-medium uppercase text-black dark:text-white">
                <span className="mb-4 mr-4 inline-flex rounded-full bg-meta px-4.5 py-1 text-metatitle uppercase text-white">
                  ELMES-QUIZ
                </span>{" "}
                Le savoir devient un pouvoir
              </span>

              {/* Affichage des promesses avec animation de fondu */}
              <div className="relative min-h-[200px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-center italic text-waterloo">
                      Aucune promesse pour le moment.
                    </p>
                    {isAdmin && (
                      <button
                        onClick={handleOpenCreate}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                        </svg>
                        Ajouter une promesse
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.7 }}
                      >
                        <h2 className="relative mb-6 text-3xl font-bold text-black dark:text-white xl:text-hero">
                          {current.title}
                        </h2>
                        <p className="mb-6 whitespace-pre-line">{current.description}</p>
                        <div>
                          <a
                            href={current.cta.url}
                            className="group mt-7.5 inline-flex items-center gap-2.5 text-black hover:text-primary dark:text-white dark:hover:text-primary"
                          >
                            <span className="duration-300 group-hover:pr-2">
                              {current.cta.label || "Know More"}
                            </span>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="currentColor"
                            >
                              <path d="M10.4767 6.16701L6.00668 1.69701L7.18501 0.518677L13.6667 7.00034L7.18501 13.482L6.00668 12.3037L10.4767 7.83368H0.333344V6.16701H10.4767Z" />
                            </svg>
                          </a>
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Badge pagination */}
                    <div className="mt-4 flex items-center gap-2">
                      {items.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentIndex(i)}
                          className={`h-2 rounded-full transition-all ${
                            i === currentIndex
                              ? "w-6 bg-primary"
                              : "w-2 bg-stroke dark:bg-strokedark"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Actions admin sur la promesse courante */}
                    {isAdmin && (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(currentIndex)}
                          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition hover:bg-primaryho"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(currentIndex)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition hover:bg-red-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Supprimer
                        </button>
                        <button
                          onClick={handleOpenCreate}
                          className="inline-flex items-center gap-1 rounded-lg border border-stroke px-3 py-1.5 text-xs text-black transition hover:bg-stroke dark:border-strokedark dark:text-white dark:hover:bg-strokedark"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                          </svg>
                          Ajouter
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Partie image */}
            <motion.div
              variants={{
                hidden: { opacity: 0, x: 20 },
                visible: { opacity: 1, x: 0 },
              }}
              initial="hidden"
              whileInView="visible"
              transition={{ duration: 1, delay: 0.1 }}
              viewport={{ once: true }}
              className="animate_right relative mx-auto hidden aspect-[588/526.5] md:block md:w-1/2"
            >
              {current?.imageUrl ? (
                <div className="relative h-full w-full">
                  <Image
                    src={current.imageUrl}
                    alt={current.title || "Promesse"}
                    fill
                    className="rounded-xl object-cover"
                  />
                  {/* Overlay dégradé du bas vers le haut */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-white via-white/60 to-transparent dark:from-blacksection dark:via-blacksection/60 dark:to-transparent" />
                </div>
              ) : (
                <>
                  <Image
                    src="./images/about/about-light-02.svg"
                    alt="About"
                    className="dark:hidden"
                    fill
                  />
                  <Image
                    src="./images/about/about-dark-02.svg"
                    alt="About"
                    className="hidden dark:block"
                    fill
                  />
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <PromesseModal
            key={modalKey}
            mode={modal.mode}
            index={modal.index}
            editData={editTarget}
            onClose={() => setModal((p) => ({ ...p, open: false }))}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default AboutRight;
