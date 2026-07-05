"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import SectionHeader from "@/components/Common/SectionHeader";
import SingleParcours from "./SingleParcours";
import ParcoursModal from "./ParcoursModal";
import { getParcoursPublic, deleteParcours } from "@/actions/parcours.actions";

interface ParcoursItem {
  _id: string;
  designation: string;
  description: string;
  categories: { _id: string; designation: string; slug: string }[];
  questions: number;
  image?: string;
  slug: string;
  status: string;
}

const ParcoursSection = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const [parcoursList, setParcoursList] = useState<ParcoursItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; mode: "create" | "edit"; data: ParcoursItem | null }>({
    open: false,
    mode: "create",
    data: null,
  });

  const fetchParcours = async () => {
    setLoading(true);
    const res = await getParcoursPublic();
    if (res.success) setParcoursList(res.parcours);
    setLoading(false);
  };

  useEffect(() => {
    fetchParcours();
  }, []);

  return (
    <>
      <section id="parcours" className="py-20 lg:py-25 xl:py-30">
        <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
          <SectionHeader
            headerInfo={{
              title: "PARCOURS",
              subtitle: "Entraîne-toi avec les Parcours",
              description: `Des parcours thématiques conçus pour les Génies. Choisis ta catégorie, réponds aux questions et grimpe dans le classement.`,
            }}
          />

          {isAdmin && (
            <div className="mb-10 text-center">
              <button
                onClick={() => setModal({ open: true, mode: "create", data: null })}
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-white transition hover:bg-primaryho"
              >
                + Nouveau parcours
              </button>
            </div>
          )}

          {loading ? (
            <div className="mt-12.5 grid grid-cols-1 gap-7.5 md:grid-cols-2 lg:mt-15 lg:grid-cols-3 xl:mt-20 xl:gap-12.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-lg border border-stroke bg-white p-7.5 dark:border-strokedark dark:bg-blacksection"
                >
                  <div className="mb-5 h-16 w-16 rounded-[4px] bg-gray-200 dark:bg-gray-700" />
                  <div className="mb-4 h-6 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mb-2 h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          ) : parcoursList.length === 0 ? (
            <div className="mt-12.5 text-center text-waterloo lg:mt-15 xl:mt-20">
              Aucun parcours disponible pour le moment.
            </div>
          ) : (
            <div className="mt-12.5 grid grid-cols-1 gap-7.5 md:grid-cols-2 lg:mt-15 lg:grid-cols-3 xl:mt-20 xl:gap-12.5">
              {parcoursList.map((parcours) => (
                <SingleParcours
                  key={parcours._id}
                  parcours={parcours}
                  isAdmin={isAdmin}
                  onEdit={() => setModal({ open: true, mode: "edit", data: parcours })}
                  onDelete={async () => {
                    if (confirm(`Supprimer le parcours "${parcours.designation}" ?`)) {
                      await deleteParcours(parcours._id);
                      fetchParcours();
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <ParcoursModal
        modal={modal}
        onClose={() => setModal({ open: false, mode: "create", data: null })}
        onSaved={fetchParcours}
      />
    </>
  );
};

export default ParcoursSection;