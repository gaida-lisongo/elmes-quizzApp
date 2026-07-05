"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SectionHeader from "../Common/SectionHeader";
import SingleTeam from "./SingleTeam";

import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import { Swiper, SwiperSlide } from "swiper/react";

import ImageUploader from "@/components/Common/ImageUploader";
import {
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from "@/actions/branding.actions";

/* ================================================================
   Types
   ================================================================ */
interface TeamMember {
  name: string;
  role: string;
  imageUrl: string;
  bio: string;
}

interface ModalState {
  open: boolean;
  mode: "create" | "edit";
  index: number | null;
}

const EMPTY_FORM = {
  name: "",
  role: "",
  bio: "",
  imageUrl: "",
};

/* ================================================================
   Modal 3 étapes pour un membre de l'équipe
   ================================================================ */
const TeamModal = ({
  mode,
  index,
  editData,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  index: number | null;
  editData?: TeamMember | null;
  onClose: () => void;
  onSaved: (team: TeamMember[]) => void;
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && editData) {
      setForm({
        name: editData.name,
        role: editData.role,
        bio: editData.bio || "",
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
        name: form.name,
        role: form.role,
        imageUrl: form.imageUrl,
        bio: form.bio,
      };

      const result =
        mode === "create"
          ? await addTeamMember(payload)
          : await updateTeamMember(index!, payload);

      if (!result.success) {
        throw new Error(result.error);
      }

      onSaved(result.team);
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
            {mode === "create"
              ? "Nouveau membre"
              : "Modifier le membre"}
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

        {/* Indicateur 3 étapes */}
        <div className="mb-6 flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step === 1 ? "bg-primary text-white" : "bg-meta text-white"
            }`}
          >
            1
          </div>
          <div className={`h-0.5 flex-1 ${step >= 2 ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step === 2 ? "bg-primary text-white" : step > 2 ? "bg-meta text-white" : "bg-stroke text-manatee dark:bg-strokedark"
            }`}
          >
            2
          </div>
          <div className={`h-0.5 flex-1 ${step >= 3 ? "bg-meta" : "bg-stroke dark:bg-strokedark"}`} />
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              step === 3 ? "bg-primary text-white" : "bg-stroke text-manatee dark:bg-strokedark"
            }`}
          >
            3
          </div>
        </div>

        {/* Étape 1 : Identité */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Nom complet
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Nom du membre"
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Rôle / Fonction
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
                placeholder="Ex: Lead Developer, Designer..."
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Étape 2 : Bio */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black dark:text-white">
                Biographie
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => updateField("bio", e.target.value)}
                placeholder="Parlez brièvement du membre..."
                rows={5}
                className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none transition focus:border-primary dark:border-strokedark dark:text-white"
              />
            </div>
          </div>
        )}

        {/* Étape 3 : Photo */}
        {step === 3 && (
          <div className="space-y-4">
            <ImageUploader
              label="Photo de profil"
              currentImage={form.imageUrl}
              onUploadComplete={(url) => updateField("imageUrl", url)}
            />
            {form.imageUrl && (
              <p className="text-xs text-green-600">✓ Photo uploadée</p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
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
            {step < 3 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && (!form.name || !form.role)) ||
                  (step === 2 && !form.bio)
                }
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
   Composant principal Team
   ================================================================ */
const Team = ({
  isAdmin = false,
  team = [],
}: {
  isAdmin?: boolean;
  team?: TeamMember[];
}) => {
  const [items, setItems] = useState<TeamMember[]>(team);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    index: null,
  });
  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [modalKey, setModalKey] = useState(0);

  useEffect(() => {
    setItems(team);
  }, [team]);

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
    if (!confirm("Supprimer ce membre de l'équipe ?")) return;
    const result = await deleteTeamMember(index);
    if (result.success) {
      setItems(result.team);
    }
  };

  const handleSaved = (updatedTeam: TeamMember[]) => {
    setItems(updatedTeam);
  };

  return (
    <>
      <section>
        <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
          {/* Section Title */}
          <div className="animate_top mx-auto text-center">
            <SectionHeader
              headerInfo={{
                title: `NOTRE ÉQUIPE`,
                subtitle: `L'équipe ELMES-QUIZ`,
                description: `Découvrez les talents qui construisent la première ligue numérique des intellectuels et de culture générale en RDC.`,
              }}
            />
          </div>

          {/* Bouton ajouter admin dans le header */}
          {isAdmin && (
            <div className="mb-8 flex justify-center">
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primaryho"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2H9v6a1 1 0 1 1-2 0V9H1a1 1 0 0 1 0-2h6V1a1 1 0 0 1 1-1z" />
                </svg>
                Ajouter un membre
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-center italic text-waterloo">
            Aucun membre dans l&apos;équipe pour le moment.
          </p>
        ) : (
          <motion.div
            variants={{
              hidden: { opacity: 0, y: -20 },
              visible: { opacity: 1, y: 0 },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 1, delay: 0.1 }}
            viewport={{ once: true }}
            className="animate_top mx-auto mt-15 max-w-c-1235 px-4 md:px-8 xl:mt-20 xl:px-0"
          >
            <div className="swiper testimonial-01 mb-20 pb-22.5">
              <Swiper
                spaceBetween={30}
                slidesPerView={1}
                autoplay={{
                  delay: 4000,
                  disableOnInteraction: false,
                }}
                pagination={{
                  clickable: true,
                }}
                modules={[Autoplay, Pagination]}
                breakpoints={{
                  0: { slidesPerView: 1 },
                  640: { slidesPerView: 2 },
                  1024: { slidesPerView: 3 },
                }}
              >
                {items.map((member, i) => (
                  <SwiperSlide key={i}>
                    <div className="relative">
                      <SingleTeam member={member} />

                      {/* Actions admin overlay */}
                      {isAdmin && (
                        <div className="mt-3 flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(i)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs text-white transition hover:bg-primaryho"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(i)}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-xs text-white transition hover:bg-red-600"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
            </div>
          </motion.div>
        )}
      </section>

      {/* Modal */}
      <AnimatePresence>
        {modal.open && (
          <TeamModal
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

export default Team;