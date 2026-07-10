import type { Metadata } from "next";

const BASE_DESCRIPTION =
  "ELMES-QUIZ est la première plateforme d'e-sport intellectuel en RDC. Jouez, progressez, compétitez et remportez des lots grâce à votre culture générale.";

export function buildMetadata(title: string): Metadata {
  return {
    title: `${title} | ELMES-QUIZ`,
    description: BASE_DESCRIPTION,
    icons: { icon: "/images/favicon.ico" },
    openGraph: {
      title: `${title} | ELMES-QUIZ`,
      description: BASE_DESCRIPTION,
      siteName: "ELMES-QUIZ",
      type: "website",
    },
  };
}