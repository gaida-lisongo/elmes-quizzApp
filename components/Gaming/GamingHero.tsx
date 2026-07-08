"use client";

import { motion } from "framer-motion";
import { ChevronRight, Medal, Target, Trophy, User, Users } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
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
  const podium = classementData.slice(0, 8);

  return (
    <section className="relative overflow-hidden pb-18 pt-35 md:pt-40 xl:pb-22 xl:pt-46">
      <div className="absolute inset-0 -z-1">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${backgroundImage})` }} />
        <div className="absolute inset-0 bg-black/65" />
        <div className="absolute inset-0 bg-linear-to-r from-black via-black/75 to-black/20" />
      </div>

      <div className="relative z-1 mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
        <div className={`grid gap-6 ${image ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} lg:gap-15`}>
          {image ? <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="hidden flex-col justify-center lg:flex"
          >
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-primary">
              <Trophy className="h-5 w-5" />
              <span className="text-white/80">ELMES-QUIZ</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold text-white xl:text-hero">{designation}</h1>
            <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-3xl">
              <Image
                fill
                src={image}
                alt={designation}
                className="object-cover"
              />
            </div>
          </motion.div> : null}

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="rounded-lg border border-white/15 bg-white/10 p-5 shadow-solid-5 backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-semibold text-white">Classement actuel</h2>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                  {targetType === "competition" ? "Equipes" : "Joueurs"}
                </span>
              </div>

              {podium.length === 0 ? (
                <div className="py-6 text-center lg:py-8">
                  <p className="text-sm text-white/70">Aucun enrollement confirme pour le moment.</p>
                  {activeCriteres.length > 0 && (
                    <p className="mt-2 text-xs text-white/45">
                      {activeCriteres.length} critere(s) de classement configure(s).
                    </p>
                  )}
                </div>
              ) : (
                <Swiper
                  spaceBetween={12}
                  slidesPerView={1}
                  autoplay={{ delay: 4000, disableOnInteraction: false }}
                  pagination={{ clickable: true }}
                  modules={[Autoplay, Pagination]}
                  className="pb-8"
                >
                  {podium.map((item, index) => (
                    <SwiperSlide key={item.id || item._id}>
                      <div className="px-1">
                        <div className="mb-4 flex items-center gap-3 lg:mb-5 lg:gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-primary lg:h-16 lg:w-16 lg:text-2xl">
                            #{index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-bold text-white lg:text-2xl">{item.name || item.pseudo}</h3>
                            <p className="truncate text-xs text-white/60 lg:text-sm">{item.session?.designation || item.content || "Session globale"}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 lg:gap-3">
                          <div className="rounded-lg border border-white/10 bg-white/10 p-3 lg:p-4">
                            <p className="text-[10px] text-white/55 lg:text-xs">Points</p>
                            <p className="mt-1 text-lg font-bold text-white lg:text-2xl">{item.points ?? item.totalScore ?? 0}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/10 p-3 lg:p-4">
                            <p className="text-[10px] text-white/55 lg:text-xs">Parties</p>
                            <p className="mt-1 text-lg font-bold text-white lg:text-2xl">{item.parties ?? item.partiesJouees ?? 0}</p>
                          </div>
                          <div className="rounded-lg border border-white/10 bg-white/10 p-3 lg:p-4">
                            <p className="text-[10px] text-white/55 lg:text-xs">Max</p>
                            <p className="mt-1 text-lg font-bold text-white lg:text-2xl">{item.maxParties ?? 0}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-xs text-white/65 lg:mt-5 lg:text-sm">
                          {targetType === "competition" ? <Users className="h-3.5 w-3.5 lg:h-4 lg:w-4" /> : <User className="h-3.5 w-3.5 lg:h-4 lg:w-4" />}
                          <span className="truncate">Classement base sur les points d'enrollement</span>
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
