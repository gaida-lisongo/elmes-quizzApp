"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SectionHeader from "@/components/Common/SectionHeader";
import SingleCompetition from "./SingleCompetition";
import CompetitionModal from "./CompetitionModal";
import { getCompetitionsPublic, deleteCompetition } from "@/actions/competitions.actions";

interface CompetitionItem {
  _id: string;
  designation: string;
  description: string;
  cagnotte: number;
  amount: number;
  categories: { _id: string; designation: string; slug: string }[];
  questions: number;
  image?: string;
  slug: string;
  status: string;
}

const CompetitionsSection = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [competitionsList, setCompetitionsList] = useState<CompetitionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; mode: "create" | "edit"; data: CompetitionItem | null }>({
    open: false,
    mode: "create",
    data: null,
  });

  const fetchCompetitions = async () => {
    setLoading(true);
    const res = await getCompetitionsPublic();
    if (res.success) setCompetitionsList(res.competitions);
    setLoading(false);
  };

  useEffect(() => {
    fetchCompetitions();
  }, []);

  return (
    <>
      <section id="competitions" className="py-20 lg:py-25 xl:py-30">
        <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
          <div className="animate_top mx-auto mb-12.5 text-center md:w-4/5 md:px-0 lg:mb-17.5 lg:w-2/3 xl:w-1/2">
            <SectionHeader
              headerInfo={{
                title: "COMPÉTITIONS",
                subtitle: "Affrontez les meilleures écuries",
                description: `Des compétitions e-sport intellectuel avec cagnottes. Inscris ton équipe, défends ta base et remporte la Bourse d'Excellence Académique.`,
              }}
            />
          </div>

          {isAdmin && (
            <div className="mb-10 text-center">
              <button
                onClick={() => setModal({ open: true, mode: "create", data: null })}
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primaryho"
              >
                + Nouvelle compétition
              </button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-7.5 md:grid-cols-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-stroke bg-white p-9 dark:border-strokedark dark:bg-blacksection"
                >
                  <div className="mb-4 h-5 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mb-6 h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mb-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : competitionsList.length === 0 ? (
            <div className="text-center text-waterloo">Aucune compétition disponible pour le moment.</div>
          ) : (
            <div className="grid grid-cols-1 gap-7.5 md:grid-cols-2">
              {competitionsList.map((competition) => (
                <SingleCompetition
                  key={competition._id}
                  competition={competition}
                  isAdmin={isAdmin}
                  onEdit={() => setModal({ open: true, mode: "edit", data: competition })}
                  onDelete={async () => {
                    if (confirm(`Supprimer la compétition "${competition.designation}" ?`)) {
                      await deleteCompetition(competition._id);
                      fetchCompetitions();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <CompetitionModal
        modal={modal}
        onClose={() => setModal({ open: false, mode: "create", data: null })}
        onSaved={fetchCompetitions}
      />
    </>
  );
};

export default CompetitionsSection;