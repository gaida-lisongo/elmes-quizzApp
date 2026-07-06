'use client';

import type { ReactNode } from "react";
import About from "../About";
import Blog from "../Blog";
import CTA from "../CTA";
import FAQ from "../FAQ";
import Testimonial from "../Testimonial";

interface GamingPageProps {
  badge?: string;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  stats?: Array<{ label: string; value: string }>;
  highlights?: string[];
  about?: any;
  faq?: any;
  cta?: any;
  children?: ReactNode;
}

export default function GamingPage({
  badge = "Gaming",
  title = "Découvrez l’univers ELMES-QUIZ",
  description = "Une expérience immersive pensée pour les joueurs et les passionnés de quiz.",
  ctaLabel = "Découvrir",
  ctaHref = "/",
  stats = [],
  highlights = [],
  about,
  faq,
  cta,
  children,
}: GamingPageProps) {
  return (
    <div className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      <About data={about} />
      <FAQ data={faq} />
      <CTA 
        title={cta?.title}
        content={cta?.content}
        action={cta?.action}
        classement={cta?.classement}
       />
      {children ? (
        <section className="py-20 lg:py-25 xl:py-30">
          <div className="mx-auto max-w-c-1280 px-4 md:px-8 xl:px-0">{children}</div>
        </section>
      ) : null}
    </div>
  );
}