'use client';

import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import About from "../About";
import CTA from "../CTA";
import FAQ from "../FAQ";
import Testimonial from "../Testimonial";
import DrawerClassement from "./DrawerClassement";
import DrawerInscription from "./DrawerInscription";
import GamingHero from "./GamingHero";

export interface EnrollmentInfo {
  type: 'player' | 'equipe';
  _id: string;
  designation?: string;
  pseudo?: string;
  level?: number;
  chefId?: string;
}

interface GamingPageProps {
  designation: string;
  description: string;
  about?: any;
  faq?: any;
  cta?: any;
  criteres?: any[];
  classementData?: any[];
  children?: ReactNode;
  targetType?: "parcours" | "competition";
  targetId?: string;
  targetName?: string;
  enrollmentInfo?: EnrollmentInfo | null;
}

export default function GamingPage({
  designation,
  description,
  about,
  faq,
  cta,
  criteres = [],
  classementData = [],
  children,
  targetType,
  targetId,
  targetName,
  enrollmentInfo,
}: GamingPageProps) {
  const [drawerClassementOpen, setDrawerClassementOpen] = useState(false);
  const [drawerInscriptionOpen, setDrawerInscriptionOpen] = useState(false);

  const handleActionClick = useCallback(
    (action: { title: string; url: string }) => {
      if (action.url === "subscripe" && targetType && targetId && enrollmentInfo) {
        setDrawerInscriptionOpen(true);
      } else if (action.url === "classement") {
        setDrawerClassementOpen(true);
      } else if (action.url && !action.url.startsWith("subscripe") && !action.url.startsWith("classement")) {
        window.location.href = action.url;
      }
    },
    [targetType, targetId, enrollmentInfo],
  );

  return (
    <div>
      {/* Hero avec critères en carrousel */}
      <GamingHero
        designation={designation}
        description={description}
        criteres={criteres}
        onShowClassement={() => setDrawerClassementOpen(true)}
      />

      <div className="overflow-hidden pb-20 xl:pb-25">
        <About data={about} />
        <FAQ data={faq} />
        <CTA 
          title={cta?.title}
          content={cta?.content}
          action={cta?.action}
          classement={cta?.classement}
          onActionClick={handleActionClick}
        />
        {classementData.length > 0 && (
          <section className="py-20 lg:py-25 xl:py-30">
            <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
              <Testimonial
                title={targetType === "competition" ? "Classement des meilleures équipes" : "Classement des meilleurs joueurs"}
                subtitle={targetType === "competition" ? "Équipes en tête" : "Joueurs en tête"}
                description="Les meilleurs performers classés selon leurs points."
                data={classementData}
              />
            </div>
          </section>
        )}
        {children ? (
          <section className="py-20 lg:py-25 xl:py-30">
            <div className="mx-auto max-w-c-1280 px-4 md:px-8 xl:px-0">{children}</div>
          </section>
        ) : null}
      </div>

      {/* Drawers */}
      <DrawerClassement
        open={drawerClassementOpen}
        onClose={() => setDrawerClassementOpen(false)}
      />
      {targetType && targetId && enrollmentInfo && (
        <DrawerInscription
          open={drawerInscriptionOpen}
          onClose={() => setDrawerInscriptionOpen(false)}
          type={targetType}
          targetId={targetId}
          targetName={targetName || ""}
          enrollmentInfo={enrollmentInfo}
        />
      )}
    </div>
  );
}