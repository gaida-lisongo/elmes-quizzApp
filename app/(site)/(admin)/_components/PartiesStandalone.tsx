"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Clock, Loader2, Play, ChevronRight, AlertCircle,
} from "lucide-react";
import { getAvailableCategoriesAction, startStandalonePartieAction, getPartieEnCoursAction } from "@/actions/partie.actions";
import type { PartieActiveData } from "@/actions/partie.actions";
import GamePlayer from "@/components/Gaming/GamePlayer";
import toast from "react-hot-toast";

export default function StandaloneParties() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partie, setPartie] = useState<PartieActiveData | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [catRes, partieRes] = await Promise.all([
      getAvailableCategoriesAction(),
      getPartieEnCoursAction(),
    ]);
    if (catRes.success) setCategories(catRes.categories || []);
    if (partieRes.success && partieRes.data) {
      // Reprendre la partie en cours
      toast("Vous avez une partie en cours !");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStart = async (categorieId: string) => {
    setStarting(categorieId);
    try {
      const res = await startStandalonePartieAction(categorieId);
      if (res.success && res.data) {
        setPartie(res.data);
      } else {
        toast.error(res.error || "Impossible de démarrer la partie.");
      }
    } catch {
      toast.error("Erreur lors du démarrage.");
    } finally {
      setStarting(null);
    }
  };

  if (partie) {
    return (
      <GamePlayer
        partie={partie}
        onFinish={() => {}}
        onCancel={() => setPartie(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
    >
      <div className="mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-semibold text-black dark:text-white">Choisissez une catégorie</h2>
      </div>

      <div className="mb-6 rounded-lg border border-stroke bg-alabaster p-4 text-sm text-waterloo dark:border-strokedark dark:bg-strokedark">
        <p className="font-medium text-black dark:text-white">Règlement</p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>• 3 questions par partie</li>
          <li>• 15 secondes par question</li>
          <li>• Une mauvaise réponse termine la partie</li>
          <li>• 1 bonne réponse = 1 point</li>
          <li>• Pour gagner, répondez correctement à toutes les questions</li>
        </ul>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-waterloo/40" />
          <p className="text-waterloo">Aucune catégorie disponible pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => handleStart(cat._id)}
              disabled={starting === cat._id}
              className="group flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 text-left transition-all hover:border-primary hover:shadow-md dark:border-strokedark dark:bg-blacksection"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Play className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-black dark:text-white truncate">{cat.designation}</p>
                {cat.description && (
                  <p className="text-xs text-waterloo truncate">{cat.description}</p>
                )}
              </div>
              {starting === cat._id ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : (
                <ChevronRight className="h-5 w-5 text-waterloo group-hover:text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}