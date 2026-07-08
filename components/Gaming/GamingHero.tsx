
"use client";

import { motion } from "framer-motion";
import { ChevronRight, Medal, Target, Trophy, User, Users } from "lucide-react";
import Image from "next/image";

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
  image: any;
  criteres: CritereDisplay[];
  classementData?: any[];
  targetType?: "parcours" | "competition";
  onShowClassement: () => void;
}

export default function GamingHero({
  designation,
  description,
  image,
  criteres,
  classementData = [],
  targetType = "parcours",
  onShowClassement,
}: GamingHeroProps) {
  const backgroundImage = targetType === "competition" ? "/images/hero/player-0.jpg" : "/images/hero/player-1.jpg";
  const activeCriteres = criteres.filter((critere) => critere.status !== false);
  
  // On prend les 5 ou 8 meilleurs pour l'aperçu de la carte
  const podium = classementData.slice(0, 6);

  return (
    <section className="relative overflow-hidden pb-12 pt-24 md:pb-18 md:pt-40 xl:pb-22 xl:pt-46">
      {/* Background avec overlay */}
      <div className="absolute inset-0 -z-1">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }} />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-linear-to-r from-black via-black/80 to-black/30" />
      </div>

      <div className="relative z-1 mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
        <div className={`grid gap-8 ${image ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} lg:gap-15 items-center`}>
          
          {/* Section Infos (Titre, Description & Bouton) */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center"
          >
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary sm:text-sm">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-white/80">ELMES-QUIZ</span>
            </div>
            
            <h1 className="mb-3 text-2xl font-bold leading-tight text-white sm:text-4xl xl:text-hero">
              {designation}
            </h1>
            
            <p className="mb-5 max-w-xl text-xs leading-relaxed text-white/75 sm:text-base whitespace-pre-line">
              {description}
            </p>

            {/* Image d'illustration sur Desktop uniquement */}
            {image && (
              <div className="relative hidden lg:block aspect-video w-full max-w-md overflow-hidden rounded-2xl border border-white/10 shadow-inner">
                <Image
                  fill
                  src={image}
                  alt={designation}
                  className="object-content"
                />
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-3">
              <button
                onClick={onShowClassement}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white transition hover:bg-primaryho shadow-md"
              >
                <Medal className="h-4 w-4" />
                Voir le classement complet
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>

          {/* Section Carte Classement : Liste Fixe / Leaderboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="rounded-xl border border-white/15 bg-white/10 p-4 shadow-solid-5 backdrop-blur-md sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <h2 className="text-base sm:text-xl font-semibold text-white">Classement actuel</h2>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] sm:text-xs font-medium text-white/70">
                  {targetType === "competition" ? "Équipes" : "Joueurs"}
                </span>
              </div>

              {podium.length === 0 ? (
                <div className="py-6 text-center lg:py-8">
                  <p className="text-xs sm:text-sm text-white/70">Aucun enrôlement confirmé pour le moment.</p>
                  {activeCriteres.length > 0 && (
                    <p className="mt-2 text-[10px] sm:text-xs text-white/45">
                      {activeCriteres.length} critère(s) de classement configuré(s).
                    </p>
                  )}
                </div>
              ) : (
                /* Conteneur de la liste avec défilement vertical si beaucoup d'éléments */
                <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
                  {podium.map((item, index) => {
                    const isTop3 = index < 3;
                    const rankColors = [
                      "bg-yellow-500 text-black", // #1 Or
                      "bg-slate-300 text-black",  // #2 Argent
                      "bg-amber-600 text-white",  // #3 Bronze
                    ];

                    return (
                      <div 
                        key={item.id || item._id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 p-2.5 transition hover:bg-white/10"
                      >
                        {/* Rang et Infos Équipe */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isTop3 ? rankColors[index] : "bg-white/10 text-white"}`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-xs sm:text-sm font-bold text-white">
                              {item.name || item.pseudo}
                            </h3>
                            <p className="truncate text-[9px] sm:text-[10px] text-white/55">
                              {item.session?.designation || item.content || "Global"}
                            </p>
                          </div>
                        </div>

                        {/* Scores / Stats de la compétition alignés à droite */}
                        <div className="flex items-center gap-4 text-right shrink-0">
                          <div className="text-[10px] sm:text-xs">
                            <span className="block text-[8px] uppercase tracking-wider text-white/40">Points</span>
                            <span className="font-bold text-primary">{item.points ?? item.totalScore ?? 0}</span>
                          </div>
                          <div className="text-[10px] sm:text-xs hidden sm:block">
                            <span className="block text-[8px] uppercase tracking-wider text-white/40">Parties</span>
                            <span className="font-semibold text-white">{item.parties ?? item.partiesJouees ?? 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Petit footer informatif sous la liste */}
              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 text-[10px] text-white/50">
                <div className="flex items-center gap-1.5">
                  {targetType === "competition" ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  <span>Mis à jour en temps réel</span>
                </div>
                <span>Top {podium.length}</span>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}