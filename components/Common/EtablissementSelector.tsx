"use client";

import { motion } from "framer-motion";
import { GraduationCap, BookOpen, User } from "lucide-react";

export type Statut = "ELEVE" | "ETUDIANT" | "INDEPENDANT";

interface EtablissementSelectorProps {
  statut: Statut;
  etablissement: string;
  onStatutChange: (s: Statut) => void;
  onEtablissementChange: (v: string) => void;
}

const STATUTS: { value: Statut; label: string; icon: React.ReactNode; description: string; placeholder: string }[] = [
  {
    value: "ELEVE",
    label: "Élève",
    icon: <BookOpen className="h-5 w-5" />,
    description: "Vous êtes au secondaire",
    placeholder: "Nom de votre école",
  },
  {
    value: "ETUDIANT",
    label: "Étudiant",
    icon: <GraduationCap className="h-5 w-5" />,
    description: "Vous êtes dans le supérieur",
    placeholder: "Nom de votre institution/université",
  },
  {
    value: "INDEPENDANT",
    label: "Ni l'un, ni l'autre",
    icon: <User className="h-5 w-5" />,
    description: "Autre situation",
    placeholder: "Indépendant",
  },
];

export default function EtablissementSelector({
  statut,
  etablissement,
  onStatutChange,
  onEtablissementChange,
}: EtablissementSelectorProps) {
  const current = STATUTS.find((s) => s.value === statut) || STATUTS[0];

  return (
    <div className="space-y-4">
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
        <GraduationCap className="h-4 w-4 text-primary" />
        Statut
      </label>

      <div className="grid grid-cols-3 gap-2">
        {STATUTS.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              onStatutChange(s.value);
              if (s.value === "INDEPENDANT") onEtablissementChange("Indépendant");
              else onEtablissementChange("");
            }}
            className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all duration-200 ${
              statut === s.value
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-stroke dark:border-strokedark hover:border-primary/50"
            }`}
          >
            <div className={`${statut === s.value ? "text-primary" : "text-waterloo"}`}>
              {s.icon}
            </div>
            <span className={`text-[11px] font-semibold leading-tight ${
              statut === s.value ? "text-black dark:text-white" : "text-waterloo"
            }`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {statut !== "INDEPENDANT" && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
            <BookOpen className="h-4 w-4 text-primary" />
            {statut === "ELEVE" ? "École" : "Institution"}
          </label>
          <input
            type="text"
            placeholder={current.placeholder}
            value={etablissement}
            onChange={(e) => onEtablissementChange(e.target.value)}
            required
            className="w-full rounded-xl border border-stroke bg-transparent px-5 py-3 text-black outline-hidden transition-all duration-200 focus:border-primary focus:shadow-[0_0_0_3px_rgba(0,107,255,0.1)] dark:border-strokedark dark:text-white dark:focus:border-primary"
          />
        </motion.div>
      )}

      {statut === "INDEPENDANT" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-alabaster p-3 text-center text-sm text-waterloo dark:bg-strokedark"
        >
          Vous serez enregistré comme <strong>Indépendant</strong>
        </motion.div>
      )}
    </div>
  );
}