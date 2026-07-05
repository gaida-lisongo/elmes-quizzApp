"use client";

import { useEffect, useState } from "react";
import Signup from "@/components/Auth/Signup";
import Loader from "@/components/Common/Loader";
import type { PlayerType } from "@/actions/signup.actions";

const TYPE_MAP: Record<string, PlayerType> = {
  standalone: "STANDALONE",
  advanced: "ADVANCED",
  vip: "VIP",
};

export default function SignupPage({
  referralCode,
}: {
  referralCode: string | null;
}) {
  const [playerType, setPlayerType] = useState<PlayerType>("STANDALONE");
  const [resolvedCode, setResolvedCode] = useState<string | null>(referralCode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Parser le hash de l'URL côté client
    const hash = window.location.hash.replace(/^#/, "");
    const [typePart, queryString] = hash.split("?");

    // Déterminer le type de joueur depuis le hash
    const detectedType = TYPE_MAP[typePart?.toLowerCase()] || "STANDALONE";
    setPlayerType(detectedType);

    // Chercher un code d'affiliation dans le hash (prioritaire) ou dans l'URL
    if (queryString) {
      const params = new URLSearchParams(queryString);
      const code = params.get("code");
      if (code) {
        setResolvedCode(code);
      }
    }

    setReady(true);
  }, []);

  if (!ready) {
    return <Loader message="Préparation de l'inscription..." size="sm" />;
  }

  return <Signup playerType={playerType} referralCode={resolvedCode} />;
}