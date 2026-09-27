"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, CheckCircle, XCircle, Loader2, Trophy,
  AlertTriangle, Zap, Star, Flag,
} from "lucide-react";
import {
  abandonnerPartieAction,
  getPartieEnCoursAction,
  submitReponseAction,
  terminerPartieAction,
} from "@/actions/partie.actions";
import type { PartieActiveData } from "@/actions/partie.actions";
import QuestionPreview from "@/components/Admin/QuestionPreview";
import toast from "react-hot-toast";

// Sons du jeu
const soundCorrect = typeof Audio !== "undefined" ? new Audio("/sounds/game/correct.wav") : null;
const soundWrong = typeof Audio !== "undefined" ? new Audio("/sounds/game/wrong.wav") : null;
const soundWin = typeof Audio !== "undefined" ? new Audio("/sounds/game/win.wav") : null;
const soundLose = typeof Audio !== "undefined" ? new Audio("/sounds/game/lose.wav") : null;

// Préchargement
if (soundCorrect) soundCorrect.preload = "auto";
if (soundWrong) soundWrong.preload = "auto";
if (soundWin) soundWin.preload = "auto";
if (soundLose) soundLose.preload = "auto";

const playSound = (sound: HTMLAudioElement | null) => {
  if (!sound) return;
  sound.currentTime = 0;
  sound.play().catch(() => {});
};

const TEMPS_PAR_QUESTION_S = 15;

const END_REASON_LABEL: Record<string, string> = {
  COMPLETED: "Partie terminée",
  WRONG_ANSWER: "Mauvaise réponse : partie terminée",
  TIMEOUT: "Temps écoulé : partie terminée",
  EXPIRED: "Partie expirée",
  ABANDONED: "Partie abandonnée",
};

interface GamePlayerProps {
  partie: PartieActiveData;
  onFinish: (resultat: any) => void;
  onCancel: () => void;
}

/** Secondes restantes, calées sur l'échéance renvoyée par le serveur. */
const secondsUntil = (expiresAt?: string | null) => {
  if (!expiresAt) return TEMPS_PAR_QUESTION_S;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.min(TEMPS_PAR_QUESTION_S, Math.ceil(ms / 1000)));
};

export default function GamePlayer({ partie, onFinish, onCancel }: GamePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(partie.questionIndex || 0);
  const [notes, setNotes] = useState(partie.notes || 0);
  const [expiresAt, setExpiresAt] = useState<string | null>(
    partie.expiresAt || new Date(Date.now() + TEMPS_PAR_QUESTION_S * 1000).toISOString(),
  );
  const [repondu, setRepondu] = useState(false);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [correction, setCorrection] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [tempsRestant, setTempsRestant] = useState(() => secondsUntil(partie.expiresAt));
  const questionRef = useRef<HTMLDivElement>(null);

  const questions = partie.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  // Avertissement avant de quitter la page pendant une partie
  useEffect(() => {
    if (finished) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [finished]);

  // Chronomètre calé sur l'échéance serveur
  useEffect(() => {
    setTempsRestant(secondsUntil(expiresAt));
    const timer = setInterval(() => setTempsRestant(secondsUntil(expiresAt)), 250);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const finish = useCallback((res: any) => {
    if (!res) return;
    setResultat(res);
    setFinished(true);
    setTimeout(() => {
      if (res.allCorrect) playSound(soundWin);
      else playSound(soundLose);
    }, 300);
    onFinish(res);
  }, [onFinish]);

  /**
   * Resynchronisation après une erreur réseau : on relit l'état serveur au lieu de rester figé.
   */
  const resync = useCallback(async () => {
    try {
      const res = await getPartieEnCoursAction();
      if (res.success && res.data && res.data.partieId === partie.partieId) {
        setCurrentIndex(res.data.questionIndex || 0);
        setNotes(res.data.notes || 0);
        setExpiresAt(res.data.expiresAt || null);
        setRepondu(false);
        setChoisi(null);
        setCorrect(null);
        setCorrection(null);
        return;
      }
      // Plus de partie en cours : elle a été clôturée (expirée ou terminée) → résultat idempotent.
      const end = res.success && res.expired ? { success: true, resultat: res.expired } : await terminerPartieAction(partie.partieId);
      if (end.success && end.resultat) finish(end.resultat);
      else onCancel();
    } catch {
      toast.error("Connexion instable. Réessayez dans un instant.");
    }
  }, [partie.partieId, finish, onCancel]);

  const handleReponse = useCallback(async (choix: string) => {
    if (repondu || submitting || finished || !currentQuestion) return;
    setSubmitting(true);
    setRepondu(true);
    setChoisi(choix);

    try {
      const res = await submitReponseAction(partie.partieId, choix);
      if (!res.success) {
        toast.error(res.error || "Réponse refusée.");
        await resync();
        return;
      }

      setCorrect(res.estCorrecte ?? false);
      setCorrection(res.correction || null);
      if (res.estCorrecte) {
        playSound(soundCorrect);
        setNotes((prev) => prev + 1);
      } else {
        playSound(soundWrong);
      }
      if (res.timeout) toast.error("Temps écoulé !");

      if (res.finished) {
        setTimeout(() => finish(res.resultat), res.estCorrecte ? 450 : 900);
        return;
      }

      setTimeout(() => {
        setRepondu(false);
        setChoisi(null);
        setCorrect(null);
        setCorrection(null);
        setCurrentIndex(res.nextIndex ?? currentIndex + 1);
        setExpiresAt(res.expiresAt || null);
      }, 450);
    } catch {
      toast.error("Erreur réseau : resynchronisation de la partie…");
      await resync();
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, repondu, submitting, finished, partie.partieId, currentIndex, finish, resync]);

  // Réponse vide envoyée automatiquement quand le temps est écoulé (le serveur tranche).
  useEffect(() => {
    if (tempsRestant === 0 && !repondu && !finished) {
      handleReponse("");
    }
  }, [tempsRestant, repondu, finished, handleReponse]);

  const handleAbandon = async () => {
    if (!window.confirm("Abandonner la partie ? Elle sera comptée comme perdue.")) return;
    setSubmitting(true);
    try {
      const res = await abandonnerPartieAction();
      if (res.success && res.resultat) finish(res.resultat);
      else if (res.success) onCancel();
      else toast.error(res.error || "Abandon impossible.");
    } catch {
      toast.error("Erreur lors de l'abandon.");
    } finally {
      setSubmitting(false);
    }
  };

  // Écran de résultats
  if (finished && resultat) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-stroke bg-white p-8 text-center shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
      >
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Trophy className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mb-2 text-2xl font-bold text-black dark:text-white">
          {resultat.allCorrect ? "Partie parfaite ! 🎉" : END_REASON_LABEL[resultat.endReason] || "Partie terminée"}
        </h2>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
            <p className="text-2xl font-bold text-primary">{resultat.note}/{resultat.nbQuestions || totalQuestions}</p>
            <p className="text-xs text-waterloo">Score</p>
          </div>
          <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
            <p className="text-2xl font-bold text-black dark:text-white">{resultat.totalScore} pts</p>
            <p className="text-xs text-waterloo">Total cumulé</p>
          </div>
          <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
            <p className="text-2xl font-bold text-black dark:text-white">Niv. {resultat.newLevel}</p>
            <p className="text-xs text-waterloo">Niveau actuel</p>
          </div>
          <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
            <p className="text-2xl font-bold text-black dark:text-white">
              {resultat.partiesRestantes ?? partie?.parties ?? 0}
            </p>
            <p className="text-xs text-waterloo">Parties restantes</p>
          </div>
        </div>
        {resultat.niveauMonte && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <Star className="h-5 w-5" />
            <span className="font-semibold">Niveau supérieur atteint !</span>
          </div>
        )}
        {resultat.equipeCredit > 0 && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <Trophy className="h-5 w-5" />
            <span className="font-semibold">Bourse créditée à l&apos;équipe : {resultat.equipeCredit.toLocaleString("fr-FR")} FC</span>
          </div>
        )}
        <button
          onClick={onCancel}
          className="rounded-xl bg-primary px-8 py-3 font-medium text-white transition hover:bg-primaryho"
        >
          Retour au menu
        </button>
      </motion.div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-waterloo">Finalisation de la partie…</p>
      </div>
    );
  }

  const progressPercent = ((currentIndex) / totalQuestions) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl"
    >
      {/* Header partie */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-black dark:text-white">
            Question {currentIndex + 1}/{totalQuestions}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            <Zap className="h-4 w-4" /> {notes} pts
          </span>
          <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
            tempsRestant > 5 ? "bg-green-100 text-green-700" :
            tempsRestant > 2 ? "bg-yellow-100 text-yellow-700" :
            "bg-red-100 text-red-700"
          }`}>
            <Clock className="h-4 w-4" />
            {tempsRestant}s
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Carte question */}
      <motion.div
        key={currentQuestion._id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        ref={questionRef}
        className="mb-6 rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {currentQuestion.type === "VRAI_FAUX" ? "Vrai/Faux" : "QCM"}
          </span>
          <span className="rounded-full bg-alabaster px-2 py-0.5 text-xs text-waterloo dark:bg-strokedark">
            Niveau {currentQuestion.level}
          </span>
        </div>
        <div className="mt-3 text-base font-medium leading-relaxed text-black dark:text-white">
          <QuestionPreview enonce={currentQuestion.enonce} mini />
        </div>
      </motion.div>

      {/* Assertions / choix */}
      <div className="space-y-3">
        {currentQuestion.assertions.map((assertion, i) => {
          const lettre = String.fromCharCode(65 + i);
          const isAnswer = repondu && correction !== null && assertion === correction;
          const isWrongChoice = repondu && correct === false && assertion === choisi;

          return (
            <button
              key={i}
              onClick={() => handleReponse(assertion)}
              disabled={repondu || submitting}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                !repondu
                  ? "border-stroke bg-white hover:border-primary hover:bg-primary/5 dark:border-strokedark dark:bg-blacksection dark:hover:border-primary"
                  : isAnswer
                  ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                  : isWrongChoice
                  ? "border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                  : "border-stroke opacity-60 dark:border-strokedark"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stroke text-xs font-bold text-waterloo dark:bg-strokedark">
                {lettre}
              </span>
              <span className="flex-1 text-black dark:text-white">
                <QuestionPreview enonce={assertion} mini />
              </span>
              {isAnswer && <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />}
              {isWrongChoice && <XCircle className="h-5 w-5 shrink-0 text-red-500" />}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {repondu && correct !== null && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 space-y-4"
          >
            {correct === true && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <CheckCircle className="h-5 w-5 shrink-0" />
                Bonne réponse ! +1 pt
              </div>
            )}
            {correct === false && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 shrink-0" />
                  Mauvaise réponse
                </div>
                {correction && (
                  <p className="mt-1 ml-7 text-red-600 dark:text-red-300">
                    Réponse attendue : <strong><QuestionPreview enonce={correction} mini /></strong>
                  </p>
                )}
              </div>
            )}

            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {correct === true && currentIndex < totalQuestions - 1 ? "Question suivante..." : "Finalisation..."}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tempsRestant === 0 && !repondu && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4" />
          Temps écoulé !
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={handleAbandon}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-xs text-waterloo transition hover:border-red-400 hover:text-red-500 disabled:opacity-50 dark:border-strokedark"
        >
          <Flag className="h-3.5 w-3.5" />
          Abandonner
        </button>
      </div>
    </motion.div>
  );
}
