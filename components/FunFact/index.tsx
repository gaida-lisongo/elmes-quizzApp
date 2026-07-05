"use client";
import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { getMetricsCounts } from "@/actions/metrics.actions";

const metrics = [
  { key: "categories" as const, label: "Catégories", suffix: "+" },
  { key: "quizzes" as const, label: "Questions", suffix: "+" },
  { key: "parties" as const, label: "Parties jouées", suffix: "" },
];

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const animated = useRef(false);

  useEffect(() => {
    if (animated.current) return;
    animated.current = true;

    const duration = 2000;
    const steps = 30;
    const increment = target / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setCount(Math.min(Math.round(increment * step), target));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <>
      {count}
      <span className="text-primary">{suffix}</span>
    </>
  );
}

const FunFact = () => {
  const [counts, setCounts] = useState({ categories: 0, quizzes: 0, parties: 0 });

  useEffect(() => {
    getMetricsCounts().then(setCounts).catch(console.error);
  }, []);

  return (
    <>
      {/* <!-- ===== Funfact Start ===== --> */}
      <section className="px-4 py-20 md:px-8 lg:py-22.5 2xl:px-0">
        <div className="relative z-1 mx-auto max-w-c-1390 rounded-lg bg-linear-to-t from-[#F8F9FF] to-[#DEE7FF] py-22.5 dark:bg-blacksection dark:bg-linear-to-t dark:from-transparent dark:to-transparent dark:stroke-strokedark xl:py-27.5">
          <Image
            width={335}
            height={384}
            src="/images/shape/shape-04.png"
            alt="Man"
            className="absolute -left-15 -top-25 -z-1 lg:left-0"
          />
          <Image
            width={132}
            height={132}
            src="/images/shape/shape-05.png"
            alt="Doodle"
            className="absolute bottom-0 right-0 -z-1"
          />

          <Image
            fill
            src="/images/shape/shape-dotted-light-02.svg"
            alt="Dotted"
            className="absolute left-0 top-0 -z-1 dark:hidden"
          />
          <Image
            fill
            src="/images/shape/shape-dotted-dark-02.svg"
            alt="Dotted"
            className="absolute left-0 top-0 -z-1 hidden dark:block"
          />

          <motion.div
            variants={{
              hidden: {
                opacity: 0,
                y: -20,
              },

              visible: {
                opacity: 1,
                y: 0,
              },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 1, delay: 0.1 }}
            viewport={{ once: true }}
            className="animate_top mx-auto mb-12.5 px-4 text-center md:w-4/5 md:px-0 lg:mb-17.5 lg:w-2/3 xl:w-1/2"
          >
            <h2 className="mb-4 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle3">
              ELMES-QUIZ en chiffres
            </h2>
            <p className="mx-auto lg:w-11/12">
              Première ligue numérique des intellectuels et de la culture générale en République Démocratique du Congo, ELMES-QUIZ est une plateforme de quiz en ligne qui met à l'épreuve vos connaissances et votre rapidité. Découvrez nos statistiques impressionnantes et rejoignez la communauté des passionnés de quiz !
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-8 lg:gap-42.5">
            {metrics.map((m, i) => (
              <motion.div
                key={m.key}
                variants={{
                  hidden: { opacity: 0, y: -20 },
                  visible: { opacity: 1, y: 0 },
                }}
                initial="hidden"
                whileInView="visible"
                transition={{ duration: 1, delay: 0.3 + i * 0.2 }}
                viewport={{ once: true }}
                className="animate_top text-center"
              >
                <h3 className="mb-2.5 text-3xl font-bold text-black dark:text-white xl:text-sectiontitle3">
                  <AnimatedCounter target={counts[m.key]} suffix={m.suffix} />
                </h3>
                <p className="text-lg lg:text-para2">{m.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* <!-- ===== Funfact End ===== --> */}
    </>
  );
};

export default FunFact;
