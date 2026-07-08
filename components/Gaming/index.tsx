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
  telephone?: string;
  email?: string;
}

export interface GamingSession {
  _id: string;
  slug: string;
  designation: string;
  startDate: string;
  endDate: string;
}

interface GamingPageProps {
  designation: string;
  description: string;
  image: any;
  about?: any;
  faq?: any;
  cta?: any;
  criteres?: any[];
  classementData?: any[];
  sessions?: GamingSession[];
  children?: ReactNode;
  targetType?: "parcours" | "competition";
  targetId?: string;
  targetName?: string;
  enrollmentInfo?: EnrollmentInfo | null;
}

export default function GamingPage({
  designation,
  description,
  image,
  about,
  faq,
  cta,
  criteres = [],
  classementData = [],
  sessions = [],
  children,
  targetType,
  targetId,
  targetName,
  enrollmentInfo,
}: GamingPageProps) {
  const [drawerClassementOpen, setDrawerClassementOpen] = useState(false);
  const [drawerInscriptionOpen, setDrawerInscriptionOpen] = useState(false);
  const [selectedClassementSession, setSelectedClassementSession] = useState<GamingSession | null>(null);

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
        image={image}
        criteres={criteres}
        classementData={classementData}
        targetType={targetType}
        onShowClassement={() => {
          setSelectedClassementSession(null);
          setDrawerClassementOpen(true);
        }}
      />

      <div className="overflow-hidden pt-10 pb-20 xl:pb-25">
        <About data={about} />
        <FAQ data={faq} />
        <CTA 
          title={cta?.title}
          content={cta?.content}
          action={cta?.action}
          classement={cta?.classement}
          onActionClick={handleActionClick}
        />
        {sessions.length > 0 && (
          <section className="py-20 lg:py-25 xl:py-30">
            <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
              <Testimonial
                title="Sessions"
                subtitle={targetType === "competition" ? "Sessions de la compétition" : "Sessions du parcours"}
                description="Sélectionnez une session pour afficher son classement précis."
                data={sessions.map((session) => ({
                  id: session._id,
                  name: session.designation,
                  image: targetType === "competition" ? "/images/hero/player-0.jpg" : "/images/hero/player-1.jpg",
                  designation: `${new Date(session.startDate).toLocaleDateString("fr-FR")} - ${new Date(session.endDate).toLocaleDateString("fr-FR")}`,
                  content: "Voir le classement de cette session",
                  raw: session,
                }))}
                onItemClick={(item) => {
                  setSelectedClassementSession(item.raw);
                  setDrawerClassementOpen(true);
                }}
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
        type={targetType === "competition" ? "Competition" : "Parcours"}
        targetId={targetId}
        sessionId={selectedClassementSession?._id}
        title={selectedClassementSession?.designation}
      />
      {targetType && targetId && enrollmentInfo && (
        <DrawerInscription
          open={drawerInscriptionOpen}
          onClose={() => setDrawerInscriptionOpen(false)}
          type={targetType}
          targetId={targetId}
          targetName={targetName || ""}
          enrollmentInfo={enrollmentInfo}
          amount={cta?.amount ?? 0}
        />
      )}
    </div>
  );
}
