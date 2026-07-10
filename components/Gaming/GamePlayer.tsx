"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, CheckCircle, XCircle, Loader2, Trophy,
  AlertTriangle, Zap, Star,
} from "lucide-react";
import { submitReponseAction, terminerPartieAction } from "@/actions/partie.actions";
import type { PartieActiveData, QuestionJeu } from "@/actions/partie.actions";
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

interface GamePlayerProps {
  partie: PartieActiveData;
  onFinish: (resultat: any) => void;
  onCancel: () => void;
}

export default function GamePlayer({ partie, onFinish, onCancel }: GamePlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(partie.questionIndex || 0);
  const [notes, setNotes] = useState(partie.notes || 0);
  const [repondu, setRepondu] = useState(false);
  const [correct, setCorrect] = useState<boolean | null>(null);
  const [correction, setCorrection] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resultat, setResultat] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tempsRestant, setTempsRestant] = useState(15);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const questionRef = useRef<HTMLDivElement>(null);

  const questions = partie.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex >= totalQuestions - 1;

  // Timer
  useEffect(() => {
    setTempsRestant(15);
    timerRef.current = setInterval(() => {
      setTempsRestant((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentIndex]);

  // Auto-submit si temps écoulé
  useEffect(() => {
    if (tempsRestant === 0 && !repondu) {
      handleReponse("");
    }
  }, [tempsRestant]);

  const handleReponse = useCallback(async (choix: string) => {
    if (repondu || submitting || !currentQuestion) return;
    setSubmitting(true);
    setRepondu(true);

    try {
      const res = await submitReponseAction(partie.partieId, currentQuestion._id, choix);
      if (res.success) {
        setCorrect(res.estCorrecte ?? false);
        setCorrection(res.correction || null);
        if (res.estCorrecte) {
          playSound(soundCorrect);
          setNotes((prev) => prev + 1);
          setTimeout(() => {
            handleNext();
          }, 450);
        } else {
          playSound(soundWrong);
          await handleFinish();
        }
      }
    } catch {
      toast.error("Erreur lors de l'envoi de la réponse.");
    } finally {
      setSubmitting(false);
    }
  }, [currentQuestion, repondu, submitting, partie.partieId]);

  const handleFinish = async () => {
      setLoading(true);
      try {
        const res = await terminerPartieAction(partie.partieId, partie?.credits || 2000);
        if (res.success && res.resultat) {
          setResultat(res.resultat);
          setFinished(true);
          // Jouer son de fin (win si toutes bonnes, lose sinon)
          setTimeout(() => {
            if (res.resultat.allCorrect) playSound(soundWin);
            else playSound(soundLose);
          }, 300);
          onFinish(res.resultat);
        } else {
          toast.error(res.error || "Erreur de finalisation.");
        }
      } catch {
        toast.error("Erreur lors de la finalisation.");
      } finally {
        setLoading(false);
      }
  };

  const handleNext = async () => {
    if (isLast) {
      await handleFinish();
    } else {
      setRepondu(false);
      setCorrect(null);
      setCorrection(null);
      setCurrentIndex((prev) => prev + 1);
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
          {resultat.allCorrect ? "Partie parfaite ! 🎉" : "Partie terminée"}
        </h2>
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-stroke p-3 dark:border-strokedark">
            <p className="text-2xl font-bold text-primary">{resultat.note}/{totalQuestions}</p>
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
            <p className="text-2xl font-bold text-black dark:text-white">{partie?.parties}</p>
            <p className="text-xs text-waterloo">Parties restantes</p>
          </div>
        </div>
        {resultat.niveauMonte && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            <Star className="h-5 w-5" />
            <span className="font-semibold">Niveau supérieur atteint !</span>
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
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <p className="text-waterloo">Aucune question disponible.</p>
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
          const isSelected = repondu;
          const isCorrect = correct === true && assertion === correction;
          const isWrong = correct === false && repondu;

          return (
            <button
              key={i}
              onClick={() => handleReponse(assertion)}
              disabled={repondu || submitting}
              className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                !repondu
                  ? "border-stroke bg-white hover:border-primary hover:bg-primary/5 dark:border-strokedark dark:bg-blacksection dark:hover:border-primary"
                  : assertion === correction && correct
                  ? "border-green-400 bg-green-50 dark:border-green-600 dark:bg-green-900/20"
                  : assertion === correction && !correct
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
              {repondu && assertion === correction && correct && (
                <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
              )}
              {repondu && assertion === correction && !correct && (
                <XCircle className="h-5 w-5 shrink-0 text-red-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback + Next */}
      <AnimatePresence>
        {repondu && (
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

            {correct === true && (
              <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-medium text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isLast ? "Finalisation..." : "Question suivante..."}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {tempsRestant === 0 && !repondu && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4" />
          Temps écoulé !
        </div>
      )}
    </motion.div>
  );
}
