"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface AboutEntrepriseProps {
  aboutElmes: {
    sigle: string;
    title: string;
    whois: string;
    description: string[];
    image: string;
    matricules: {
      rccm: string;
      idNat: string;
      affCnss: string;
      imInpp: string;
    };
  };
}

const AboutEntreprise = ({ aboutElmes }: AboutEntrepriseProps) => {
  const { sigle, title, whois, description, image, matricules } = aboutElmes;

  return (
    <section className="overflow-hidden pb-20 lg:pb-25 xl:pb-30">
      <div className="mx-auto max-w-c-1235 px-4 md:px-8 xl:px-0">
        <div className="flex flex-col-reverse items-center gap-8 lg:flex-row lg:gap-32.5">
          {/* ===== Colonne gauche : Who is + Matricules ===== */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -20 },
              visible: { opacity: 1, x: 0 },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 0.7, delay: 0.1 }}
            viewport={{ once: true }}
            className="animate_left md:w-1/2"
          >
            {/* Who is */}
            <span className="mb-4 inline-block rounded-full bg-meta px-4.5 py-1 text-metatitle uppercase text-white">
              QUI SOMMES-NOUS
            </span>
            <p className="mb-8 text-lg font-medium italic text-black dark:text-white">
              {whois}
            </p>

            {/* Logo / Image */}
            <div className="relative mb-8 flex justify-center">
              <div className="relative h-28 w-28 overflow-hidden rounded-2xl bg-white p-2 shadow-solid-5 dark:bg-blacksection">
                <Image
                  src={image}
                  alt={sigle}
                  fill
                  className="object-contain p-2"
                />
              </div>
            </div>

            {/* Matricules */}
            <div className="space-y-4">
              <h3 className="text-metatitle2 font-semibold text-black dark:text-white">
                Nos matricules
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-blacksection">
                  <p className="text-xs font-medium uppercase text-waterloo">
                    RCCM
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {matricules.rccm}
                  </p>
                </div>
                <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-blacksection">
                  <p className="text-xs font-medium uppercase text-waterloo">
                    ID. Nationale
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {matricules.idNat}
                  </p>
                </div>
                <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-blacksection">
                  <p className="text-xs font-medium uppercase text-waterloo">
                    CNSS
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {matricules.affCnss}
                  </p>
                </div>
                <div className="rounded-lg border border-stroke bg-white p-4 dark:border-strokedark dark:bg-blacksection">
                  <p className="text-xs font-medium uppercase text-waterloo">
                    INPP
                  </p>
                  <p className="mt-1 text-sm font-semibold text-black dark:text-white">
                    {matricules.imInpp}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ===== Colonne droite : Sigle + Titre + Description ===== */}
          <motion.div
            variants={{
              hidden: { opacity: 0, x: 20 },
              visible: { opacity: 1, x: 0 },
            }}
            initial="hidden"
            whileInView="visible"
            transition={{ duration: 0.7, delay: 0.1 }}
            viewport={{ once: true }}
            className="animate_right md:w-1/2"
          >
            {/* Sigle badge */}
            <span className="mb-4 inline-block rounded-full bg-primary px-4.5 py-1 text-metatitle uppercase text-white">
              {sigle}
            </span>

            {/* Titre */}
            <h2 className="relative mb-6 text-3xl font-bold text-black dark:text-white xl:text-hero">
              <span className="relative inline-block before:absolute before:bottom-2.5 before:left-0 before:-z-1 before:h-3 before:w-full before:bg-titlebg2 dark:before:bg-titlebgdark">
                {title}
              </span>
            </h2>

            {/* Description (paragraphes animés) */}
            <div className="space-y-4">
              {description.map((paragraph, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }}
                  viewport={{ once: true }}
                  className="leading-relaxed text-waterloo"
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutEntreprise;