"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Swords, Trophy, Clock, Loader2, Play, ChevronRight, AlertCircle, Users,
} from "lucide-react";
import { getMyEquipeEnrollmentsAction, startMatchPartieAction, getPartieEnCoursAction } from "@/actions/partie.actions";
import type { PartieActiveData } from "@/actions/partie.actions";
import GamePlayer from "@/components/Gaming/GamePlayer";
import toast from "react-hot-toast";

export default function VipMatchs() {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [partie, setPartie] = useState<PartieActiveData | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await getMyEquipeEnrollmentsAction();
    if (res.success) setEnrollments(res.enrollments || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleStart = async (enrollmentId: string, amount: number) => {
    setStarting(enrollmentId);
    try {
      const res = await startMatchPartieAction(enrollmentId);
      if (res.success && res.data) {
        setPartie({...res.data, credits: amount});
        // Mettre à jour les parties restantes dans la liste des enrollments
        setEnrollments(prev => prev.map(enr => 
          enr._id === enrollmentId 
            ? { ...enr, parties: (enr.parties || 0) + 1 }
            : enr
        ));
      } else {
        toast.error(res.error || "Impossible de démarrer.");
      }
    } catch {
      toast.error("Erreur.");
    } finally {
      setStarting(null);
    }
  };

  if (partie) {
    return (
      <GamePlayer
        partie={partie}
        onFinish={() => {
          setPartie(null);
          load(); // Recharger les enrollments pour mettre à jour les parties restantes
        }}
        onCancel={() => {
          setPartie(null);
          load(); // Recharger même si annulé (la partie a été comptée)
        }}
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
      className="space-y-6"
    >
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">Matchs de l'équipe</h2>
        </div>

        <div className="mb-6 rounded-lg border border-stroke bg-alabaster p-4 text-sm text-waterloo dark:border-strokedark dark:bg-strokedark">
          <p className="font-medium text-black dark:text-white">Règlement</p>
          <ul className="mt-2 space-y-1 text-xs">
            <li>• 5 questions tirées au hasard des catégories de la compétition</li>
            <li>• 15 secondes par question</li>
            <li>• Une mauvaise réponse termine la partie</li>
            <li>• 1 bonne réponse = 1 point</li>
          </ul>
        </div>

        {enrollments.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-waterloo/40" />
            <p className="text-waterloo">Aucune compétition en cours pour votre équipe.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {enrollments.map((enr) => {
              const competition = enr.competitionId || {};
              const session = enr.sessionId || {};
              const remainingGames = enr.remainingGames ?? Math.max(0, (enr?.maxParties || 0) - (enr.parties || 0));
              return (
                <button
                  key={enr._id}
                  onClick={() => remainingGames > 0 && session.status === "COMPLETED" ? handleStart(enr._id, 0) : console.log("Match indisponible")}
                  disabled={starting === enr._id || remainingGames <= 0 || session.status !== "COMPLETED"}
                  className="group flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 text-left transition-all hover:border-primary hover:shadow-md dark:border-strokedark dark:bg-blacksection disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/10">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-black dark:text-white truncate">{competition.designation || "Compétition"}</p>
                    <p className="text-xs text-waterloo">
                      {session.designation || "Session"} — {(enr?.maxParties || 0) - (enr.parties || 0)} parties restantes
                    </p>
                  </div>
                  {starting === enr._id ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-waterloo group-hover:text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
