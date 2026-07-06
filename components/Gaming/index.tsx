'use client';

import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import About from "../About";
import Blog from "../Blog";
import CTA from "../CTA";
import FAQ from "../FAQ";
import Testimonial from "../Testimonial";
import DrawerClassement from "./DrawerClassement";
import DrawerInscription from "./DrawerInscription";

interface GamingPageProps {
  about?: any;
  faq?: any;
  cta?: any;
  children?: ReactNode;
  targetType?: "parcours" | "competition";
  targetId?: string;
  targetName?: string;
}

export default function GamingPage({
  about,
  faq,
  cta,
  children,
  targetType,
  targetId,
  targetName,
}: GamingPageProps) {
  const [drawerClassementOpen, setDrawerClassementOpen] = useState(false);
  const [drawerInscriptionOpen, setDrawerInscriptionOpen] = useState(false);

  const handleActionClick = useCallback(
    (action: { title: string; url: string }) => {
      if (action.url === "subscripe" && targetType && targetId) {
        setDrawerInscriptionOpen(true);
      } else if (action.url === "classement") {
        setDrawerClassementOpen(true);
      } else if (action.url && !action.url.startsWith("subscripe") && !action.url.startsWith("classement")) {
        window.location.href = action.url;
      }
    },
    [targetType, targetId],
  );

  return (
    <div className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      <About data={about} />
      <FAQ data={faq} />
      <CTA 
        title={cta?.title}
        content={cta?.content}
        action={cta?.action}
        classement={cta?.classement}
        onActionClick={handleActionClick}
       />
      {children ? (
        <section className="py-20 lg:py-25 xl:py-30">
          <div className="mx-auto max-w-c-1280 px-4 md:px-8 xl:px-0">{children}</div>
        </section>
      ) : null}

      {/* Drawers */}
      <DrawerClassement
        open={drawerClassementOpen}
        onClose={() => setDrawerClassementOpen(false)}
      />
      {targetType && targetId && (
        <DrawerInscription
          open={drawerInscriptionOpen}
          onClose={() => setDrawerInscriptionOpen(false)}
          type={targetType}
          targetId={targetId}
          targetName={targetName || ""}
        />
      )}
    </div>
  );
}