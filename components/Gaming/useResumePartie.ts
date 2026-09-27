"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { getPartieEnCoursAction } from "@/actions/partie.actions";
import type { PartieActiveData } from "@/actions/partie.actions";

/**
 * Au montage d'un écran de jeu (EX-JEU-01) : rouvre la partie en cours si elle est encore
 * reprenable, ou prévient le joueur que sa partie précédente a expiré (comptée comme perdue).
 */
export function useResumePartie(onResume: (data: PartieActiveData) => void) {
  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  useEffect(() => {
    let cancelled = false;
    getPartieEnCoursAction()
      .then((res) => {
        if (cancelled || !res?.success) return;
        if (res.data) {
          onResumeRef.current(res.data);
          toast("Partie en cours reprise.");
        } else if (res.expired) {
          toast("Votre partie précédente a expiré : elle a été comptée comme perdue.");
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
}
