"use client";
import React from "react";
import { motion } from "framer-motion";
import { Zap, Swords, Trophy, CreditCard } from "lucide-react";

interface TrainingPass {
  slug: string;
  designation: string;
  description: string;
  cible: string;
  amountCDF: number;
  amountUSD: number;
  parties: number;
  bonus: number;
  totalParties: number;
  totalQuestions: number;
  avantages: string[];
}

const iconMap: Record<string, React.ElementType> = { Zap, Swords, Trophy };

const SinglePass = ({
  pass,
  index,
  onBuy,
}: {
  pass: TrainingPass;
  index: number;
  onBuy: () => void;
}) => {
  const iconKey = pass.slug === "elembo" ? "Zap" : pass.slug === "motuya" ? "Swords" : "Trophy";
  const Icon = iconMap[iconKey] || CreditCard;
  const isPopular = index === 1;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 },
      }}
      initial="hidden"
      whileInView="visible"
      transition={{ duration: 0.6, delay: index * 0.15 }}
      viewport={{ once: true }}
      className="animate_top group relative rounded-lg border border-stroke bg-white p-6 shadow-solid-10 transition-all hover:shadow-solid-4 dark:border-strokedark dark:bg-blacksection dark:shadow-none md:w-[45%] lg:w-1/3 xl:p-8"
    >
      {isPopular && (
        <div className="absolute -right-3.5 top-7.5 -rotate-90 rounded-bl-full rounded-tl-full bg-primary px-4.5 py-1.5 text-metatitle font-medium uppercase text-white">
          populaire
        </div>
      )}

      {/* En-tête avec icône */}
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h4 className="text-xl font-bold text-black dark:text-white">
            {pass.designation}
          </h4>
          <span className="text-xs font-medium text-primary">{pass.cible}</span>
        </div>
      </div>

      <p className="mb-6 text-sm text-waterloo">{pass.description}</p>

      {/* Prix */}
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-black dark:text-white xl:text-[40px]">
          {pass.amountCDF.toLocaleString()} FC
        </span>
        <span className="text-sm text-waterloo">
          / ${pass.amountUSD}
        </span>
      </div>

      {/* Parties */}
      <div className="mb-6 flex justify-between rounded-lg bg-alabaster px-4 py-3 dark:bg-strokedark">
        <div className="text-center">
          <p className="text-xs text-waterloo">Parties</p>
          <p className="font-bold text-black dark:text-white">{pass.parties}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-waterloo">Bonus</p>
          <p className="font-bold text-green-500">+{pass.bonus}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-waterloo">Total</p>
          <p className="font-bold text-primary">{pass.totalParties}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-waterloo">Questions</p>
          <p className="font-bold text-black dark:text-white">{pass.totalQuestions}</p>
        </div>
      </div>

      {/* Avantages */}
      <ul className="mb-8 space-y-3">
        {pass.avantages.map((av, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-black dark:text-manatee">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
            {av}
          </li>
        ))}
      </ul>

      {/* Bouton */}
      <button
        onClick={onBuy}
        className="group/btn inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-primary px-6 py-3 font-medium text-white shadow-md transition-all duration-300 hover:bg-primaryho"
      >
        <CreditCard className="h-4 w-4" />
        <span className="duration-300 group-hover/btn:pr-2">Acheter le pass</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          xmlns="http://www.w3.org/2000/svg"
          className="duration-300 group-hover/btn:translate-x-1"
        >
          <path
            d="M10.4767 6.16701L6.00668 1.69701L7.18501 0.518677L13.6667 7.00034L7.18501 13.482L6.00668 12.3037L10.4767 7.83368H0.333344V6.16701H10.4767Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </motion.div>
  );
};

export default SinglePass;