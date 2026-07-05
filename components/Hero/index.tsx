"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

const pitches = [
  {
    id: "player-0.jpg",
    key: "STANDALONE",
    cible: "Pour les Intélligents",
    url: "/auth/signup#standalone",
    title: "Ne brûle plus tes mégas dans le vide",
    description:
      "Transforme quelques minutes de connexion en défi de culture générale. Avec ELMES-QUIZ, tu joues seul, tu testes ton niveau et tu gardes ton cerveau actif sans pression."
  },
  {
    id: "player-1.jpg",
    key: "ADVANCED",
    cible: "Pour les Génies",
    url: "/auth/signup#advanced",
    title: "Zéro hasard. 100% mérite intellectuel",
    description:
      "Passe à l’entraînement sérieux. Réponds sous chrono, progresse dans les niveaux, active tes Pass d’Entraînement et avance dans le Parcours du Mois pour viser la Prime du Mérite Mensuel."
  },
  {
    id: "player-2.jpg",
    key: "VIP",
    cible: "Pour les Compétiteurs",
    url: "/auth/signup#vip",
    title: "Ne joue pas seul, crée ton écurie",
    description:
      "Monte ton équipe de 5 cerveaux, défends ta base et affronte les meilleures écuries dans une compétition d’e-sport intellectuel structurée autour de la Bourse d’Excellence Académique."
  }
];

const Hero = () => {
  const [currentPitch, setCurrentPitch] = useState(0);
  const pitch = pitches[currentPitch];

  // Changement automatique toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPitch((prev) => (prev + 1) % pitches.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <section className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
        <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
          <div className="flex lg:items-center lg:gap-8 xl:gap-32.5">
            <div className="md:w-1/2">
              <h4 className="mb-4.5 text-lg font-medium text-black dark:text-white">
                🔥 ELMES-QUIZ, Le savoir devient un pouvoir
              </h4>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPitch}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                >
                  <h1 className="mb-5 pr-16 text-3xl font-bold text-black dark:text-white xl:text-hero ">
                    {pitch.cible}
                  </h1>
                  <p>{pitch.description}</p>

                  <div className="mt-10">
                    <div className="flex flex-wrap gap-5">
                      <Link
                        href="/about"
                        className="flex rounded-full bg-black px-7.5 py-2.5 text-white duration-300 ease-in-out hover:bg-blackho dark:bg-btndark dark:hover:bg-blackho"
                      >
                        En savoir plus
                      </Link>
                      <Link
                        href={pitch.url}
                        className="flex rounded-full border border-stroke px-7.5 py-2.5 text-black duration-300 ease-in-out hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800"
                      >
                        Créer un compte
                      </Link>
                    </div>

                    <p className="mt-5 text-black dark:text-white">
                      {pitch.title}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation dots */}
              <div className="mt-8 flex gap-2">
                {pitches.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPitch(index)}
                    className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                      index === currentPitch
                        ? "w-8 bg-primary"
                        : "bg-gray-300 dark:bg-gray-600"
                    }`}
                    aria-label={`Pitch ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="animate_right hidden md:w-1/2 lg:block">
              <div className="relative 2xl:-mr-7.5">
                <Image
                  src="/images/shape/shape-01.png"
                  alt="shape"
                  width={46}
                  height={246}
                  className="absolute -left-11.5 top-0"
                />
                <Image
                  src="/images/shape/shape-02.svg"
                  alt="shape"
                  width={36.9}
                  height={36.7}
                  className="absolute bottom-0 right-0 z-10"
                />
                <Image
                  src="/images/shape/shape-03.svg"
                  alt="shape"
                  width={21.64}
                  height={21.66}
                  className="absolute -right-6.5 bottom-0 z-1"
                />
                <div className="relative aspect-700/444 w-full overflow-hidden rounded-2xl">
                  {/* Overlay sombre → clair du haut vers le bas */}
                  <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-gradient-to-t from-black/60 via-transparent to-white/20" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={pitch.id}
                      className="absolute inset-0"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    >
                      <Image
                        className="rounded-2xl object-cover shadow-solid-l"
                        src={`/images/hero/${pitch.id}`}
                        alt={pitch.cible}
                        fill
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default Hero;
