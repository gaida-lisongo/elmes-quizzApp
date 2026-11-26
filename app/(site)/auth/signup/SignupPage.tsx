"use client";

import { useEffect, useState } from "react";
import Signup from "@/components/Auth/Signup";
import Loader from "@/components/Common/Loader";
import type { PlayerType } from "@/actions/signup.actions";
import { palierDepuisSlug } from "@/lib/utils/paliers";


export default function SignupPage({
  referralCode,
}: {
  referralCode: string | null;
}) {
  const [playerType, setPlayerType] = useState<PlayerType>("PALIER_1");
  const [resolvedCode, setResolvedCode] = useState<string | null>(referralCode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Parser l'URL actuelle : hash ET searchParams
    const hash = window.location.hash.replace(/^#/, "");
    const [typePart, queryString] = hash.split("?");

    // Déterminer le type de joueur depuis le hash
    const detectedType = palierDepuisSlug(typePart);
    setPlayerType(detectedType);

    // Chercher un code d'affiliation : priorité au hash, puis searchParams, puis prop serveur
    let code: string | null = null;

    if (queryString) {
      const params = new URLSearchParams(queryString);
      code = params.get("code");
    }

    if (!code) {
      const params = new URLSearchParams(window.location.search);
      code = params.get("code");
    }

    setResolvedCode(code || referralCode);

    setReady(true);
  }, [referralCode]);

  if (!ready) {
    return <Loader message="Préparation de l'inscription..." size="sm" />;
  }

  return <Signup playerType={playerType} referralCode={resolvedCode} />;
}