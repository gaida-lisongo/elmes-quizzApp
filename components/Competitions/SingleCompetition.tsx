"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Pencil, Trash2, Swords } from "lucide-react";

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

const SingleCompetition = ({
  competition,
  isAdmin = false,
  onEdit,
  onDelete,
}: {
  competition: CompetitionItem;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: -20 },
        visible: { opacity: 1, y: 0 },
      }}
      initial="hidden"
      whileInView="visible"
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="group relative overflow-hidden rounded-lg bg-white shadow-solid-9 transition-all hover:shadow-solid-4 dark:border dark:border-strokedark dark:bg-blacksection dark:shadow-none"
    >
      {/* Image de fond avec overlay */}
      <Link href={`/competition/${competition.slug}`}>
        <div className="relative h-52 w-full overflow-hidden">
          {competition.image ? (
            <>
              <Image
                src={competition.image}
                alt={competition.designation}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/30 text-4xl font-bold text-white backdrop-blur-sm">
                {competition.designation.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          {/* Badge cagnotte */}
          <div className="absolute right-3 top-3 rounded-full bg-yellow-500 px-3 py-1 text-xs font-bold text-white shadow-md">
            🏆 {new Intl.NumberFormat().format(competition.cagnotte)} CDF
          </div>
          {/* Badge inscription */}
          <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-black shadow-md backdrop-blur-sm">
            {new Intl.NumberFormat().format(competition.amount)} CDF
          </div>
        </div>
      </Link>

      {/* Contenu */}
      <div className="p-5 xl:p-6">
        <Link href={`/competition/${competition.slug}`}>
          <h3 className="mb-2 text-lg font-semibold text-black dark:text-white xl:text-xl">
            {competition.designation}
          </h3>
          <p className="mb-3 line-clamp-2 text-sm text-waterloo">
            {competition.description}
          </p>
        </Link>

        {competition.categories && competition.categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {competition.categories.slice(0, 3).map((cat) => (
              <span
                key={cat._id}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary dark:bg-primary/20"
              >
                {cat.designation}
              </span>
            ))}
            {competition.categories.length > 3 && (
              <span className="text-[11px] text-waterloo">+{competition.categories.length - 3}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-stroke pt-3 dark:border-strokedark">
          {isAdmin ? (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white"
              >
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" /> Supprimer
              </button>
            </div>
          ) : (
            <Link
              href={`/competition/${competition.slug}`}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-md transition hover:bg-primaryho"
            >
              <Swords className="h-3.5 w-3.5" /> Participer
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SingleCompetition;