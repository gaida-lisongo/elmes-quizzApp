"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, ChevronRight, Loader2, X, Users, Target } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";

interface CritereDisplay {
  _id: string;
  designation: string;
  description: string;
  status?: boolean;
  first: any[];
  second: any[];
  third: any[];
}

interface GamingHeroProps {
  designation: string;
  description: string;
  criteres: CritereDisplay[];
  onShowClassement: () => void;
}

export default function GamingHero({ designation, description, criteres, onShowClassement }: GamingHeroProps) {
  const activeCriteres = criteres.filter(c => c.status !== false);

  return (
    <section className="relative overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      {/* Décorations */}
      <div className="pointer-events-none absolute inset-0 -z-1">
        <div className="absolute left-0 top-0 h-2/3 w-full bg-linear-to-t from-transparent to-[#dee7ff47] dark:bg-linear-to-t dark:to-[#252A42]" />
        <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-1 mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-15">
          {/* Colonne gauche - Titre & description */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
              <Trophy className="h-5 w-5" />
              <span>ELMES-QUIZ</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold text-black dark:text-white xl:text-hero">
              {designation}
            </h1>
            <p className="mb-8 text-lg text-waterloo">
              {description}
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={onShowClassement}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition hover:bg-primaryho"
              >
                <Medal className="h-5 w-5" />
                Voir le classement
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* Colonne droite - Carrousel des critères */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Critères de classement</h2>
              </div>

              {activeCriteres.length === 0 ? (
                <p className="py-6 text-center text-sm text-waterloo">Aucun critère défini pour le moment.</p>
              ) : (
                <Swiper
                  spaceBetween={20}
                  slidesPerView={1}
                  autoplay={{ delay: 4000, disableOnInteraction: false }}
                  pagination={{ clickable: true }}
                  modules={[Autoplay, Pagination]}
                  className="pb-10"
                >
                  {activeCriteres.map((critere) => (
                    <SwiperSlide key={critere._id}>
                      <div className="space-y-4 px-1">
                        <h3 className="text-lg font-bold text-black dark:text-white">{critere.designation}</h3>
                        {critere.description && (
                          <p className="text-sm text-waterloo">{critere.description}</p>
                        )}

                        <div className="space-y-3">
                          {/* 1ère place */}
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/20 dark:bg-emerald-900/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">🏆 1ère place</span>
                              <span className="text-xs text-waterloo">{critere.first?.[0]?.points || 0} pts</span>
                            </div>
                            <p className="mt-0.5 text-xs text-waterloo">{critere.first?.[0]?.recompense || '—'} · 2 qualifié(s)</p>
                          </div>

                          {/* 2ème place */}
                          <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-500/20 dark:bg-purple-900/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">🥈 2ème place</span>
                              <span className="text-xs text-waterloo">{critere.second?.[0]?.points || 0} pts</span>
                            </div>
                            <p className="mt-0.5 text-xs text-waterloo">{critere.second?.[0]?.recompense || '—'} · 4 qualifié(s)</p>
                          </div>

                          {/* 3ème place */}
                          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-500/20 dark:bg-amber-900/10">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">🥉 3ème place</span>
                              <span className="text-xs text-waterloo">{critere.third?.[0]?.points || 0} pts</span>
                            </div>
                            <p className="mt-0.5 text-xs text-waterloo">{critere.third?.[0]?.recompense || '—'} · 6 qualifié(s)</p>
                          </div>
                        </div>
                      </div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}