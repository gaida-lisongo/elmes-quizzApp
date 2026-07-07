"use client";

import { useState } from "react";
import { Share2, CheckCircle2 } from "lucide-react";

interface ShareLinkProps {
  url: string;
  title?: string;
  description?: string;
  className?: string;
}

export default function ShareLink({
  url,
  title = "Partager",
  description = "Découvrez cette invitation",
  className = "",
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title,
          text: description,
          url,
        });
        return;
      }
    } catch {
      // Fallback vers la copie
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      // Ignorer l'erreur de copie
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm text-waterloo transition hover:bg-stroke dark:border-strokedark dark:hover:bg-strokedark ${className}`}
    >
      {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
      {copied ? "Lien copié" : "Partager"}
    </button>
  );
}
