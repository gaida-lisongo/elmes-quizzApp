"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageUploader from "@/components/Common/ImageUploader";
import {
  addValeur,
  updateValeur,
  deleteValeur,
} from "@/actions/branding.actions";

/* ================================================================
   Types
   ================================================================ */
interface Valeur {
  title: string;
  description: string;
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
  imageUrl: "",
};

/* ================================================================
   Sous-composant : Modal deux étapes pour une valeur
   ================================================================ */
const ValeurModal = ({
  mode,
  index,
  editData,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  index: number | null;
  editData?: Valeur | null;
  onClose: () => void;
  onSaved: (valeurs: Valeur[]) => void;
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
        imageUrl: form.imageUrl,
      };

      const result =
        mode === "create"
          ? await addValeur(payload)
          : await updateValeur(index!, payload);

      if (!result.success) {
        throw new Error(result.error);
      }

      onSaved(result.valeurs);
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
            {mode === "create" ? "Nouvelle valeur" : "Modifier la valeur"}
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

        {/* Étape 1 : titre + description */}
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
                placeholder="Titre de la valeur"
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
                placeholder="Description de la valeur"
                rows={4}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Étape 2 : Image */}
        {step === 2 && (
          <div className="space-y-4">
            <ImageUploader
              label="Image de la valeur"
              currentImage={form.imageUrl}
              onUploadComplete={(url) => updateField("imageUrl", url)}
            />
            {form.imageUrl && (
              <p className="text-xs text-green-600">✓ Image uploadée</p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

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
   Composant principal FeaturesTab (réutilisable)
   ================================================================ */
const FeaturesTab = ({
  isAdmin = false,
  valeurs = [],
}: {
  isAdmin?: boolean;
  valeurs?: Valeur[];
}) => {
  const [items, setItems] = useState<Valeur[]>(valeurs);
  const [currentTab, setCurrentTab] = useState(0);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    index: null,
  });
  const [editTarget, setEditTarget] = useState<Valeur | null>(null);
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    setItems(valeurs);
  }, [valeurs]);

  useEffect(() => {
    if (items.length === 0) return;
    if (currentTab >= items.length) setCurrentTab(0);
  }, [items.length, currentTab]);

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
    if (!confirm("Supprimer cette valeur ?")) return;
    const result = await deleteValeur(index);
    if (result.success) {
      setItems(result.valeurs);
      if (currentTab >= result.valeurs.length) {
        setCurrentTab(0);
      }
    }
  };

  const handleSaved = (updatedValeurs: Valeur[]) => {
    setItems(updatedValeurs);
    setCurrentTab(0);
  };

  const current = items[currentTab];

  return (
    <>
      <section className="relative pb-20 pt-18.5 lg:pb-22.5">
        <div className="relative mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
          <div className="absolute -top-16 -z-1 mx-auto h-[350px] w-[90%]">
            <Image
              fill
              className="dark:hidden"
              src="/images/shape/shape-dotted-light.svg"
              alt="Dotted Shape"
            />
            <Image
              fill
              className="hidden dark:block"
              src="/images/shape/shape-dotted-dark.svg"
              alt="Dotted Shape"
            />
          </div>

          {items.length === 0 && !isAdmin ? (
            <p className="text-center italic text-waterloo">
              Aucune valeur pour le moment.
            </p>
          ) : (
            <>
              {/* Tab Menues */}
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: -20 },
                  visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                whileInView="visible"
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="animate_top mb-15 flex flex-wrap justify-center rounded-[10px] border border-stroke bg-white shadow-solid-5 dark:border-strokedark dark:bg-blacksection dark:shadow-solid-6 md:flex-nowrap md:items-center lg:gap-7.5 xl:mb-21.5 xl:gap-12.5"
              >
                {items.map((v, i) => (
                  <div
                    key={i}
                    onClick={() => setCurrentTab(i)}
                    className={`relative flex w-full cursor-pointer items-center gap-4 border-b border-stroke px-6 py-2 last:border-0 dark:border-strokedark md:w-auto md:border-0 xl:px-13.5 xl:py-5 ${
                      currentTab === i
                        ? "active before:absolute before:bottom-0 before:left-0 before:h-1 before:w-full before:rounded-tl-[4px] before:rounded-tr-[4px] before:bg-primary"
                        : ""
                    }`}
                  >
                    <div className="flex h-12.5 w-12.5 items-center justify-center rounded-[50%] border border-stroke dark:border-strokedark dark:bg-blacksection">
                      <p className="text-metatitle3 font-medium text-black dark:text-white">
                        {String(i + 1).padStart(2, "0")}
                      </p>
                    </div>
                    <div className="md:w-3/5 lg:w-auto">
                      <button className="text-sm font-medium text-black dark:text-white xl:text-regular">
                        {v.title}
                      </button>
                    </div>
                  </div>
                ))}

                {/* Bouton ajouter admin dans la barre d'onglets */}
                {isAdmin && (
                  <button
                    onClick={handleOpenCreate}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-primary transition hover:text-primaryho"
                    title="Ajouter une valeur"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                    </svg>
                    <span className="hidden md:inline">Ajouter</span>
                  </button>
                )}
              </motion.div>

              {/* Tab Content */}
              {current && (
                <motion.div
                  key={currentTab}
                  variants={{
                    hidden: { opacity: 0, y: -20 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  initial="hidden"
                  animate="visible"
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="animate_top mx-auto max-w-c-1154"
                >
                  <div className="flex items-center gap-8 lg:gap-19">
                    <div className="md:w-1/2">
                      <h2 className="mb-7 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle2">
                        {current.title}
                      </h2>
                      <p className="mb-5 whitespace-pre-line">
                        {current.description}
                      </p>

                      {/* Actions admin */}
                      {isAdmin && (
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => handleOpenEdit(currentTab)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition hover:bg-primaryho"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(currentTab)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition hover:bg-red-600"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="relative mx-auto hidden aspect-562/366 max-w-[550px] md:block md:w-1/2">
                      {current.imageUrl ? (
                        <Image
                          src={current.imageUrl}
                          alt={current.title}
                          fill
                          className="rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center rounded-xl bg-stroke dark:bg-strokedark">
                          <span className="text-waterloo">Aucune image</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* Message et bouton admin si aucune valeur */}
          {items.length === 0 && isAdmin && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-center italic text-waterloo">
                Aucune valeur pour le moment.
              </p>
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                </svg>
                Ajouter une valeur
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <ValeurModal
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

export default FeaturesTab;
