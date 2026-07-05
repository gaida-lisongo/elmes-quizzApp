"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Pencil, Trash2, Eye } from "lucide-react";

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

const SingleParcours = ({
  parcours,
  isAdmin = false,
  onEdit,
  onDelete,
}: {
  parcours: ParcoursItem;
  isAdmin?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) => {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: -10 },
        visible: { opacity: 1, y: 0 },
      }}
      initial="hidden"
      whileInView="visible"
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="animate_top group relative z-40 overflow-hidden rounded-lg border border-white bg-white shadow-solid-3 transition-all hover:shadow-solid-4 dark:border-strokedark dark:bg-blacksection dark:hover:bg-hoverdark"
    >
      {/* Image de fond avec overlay */}
      <Link href={`/parcours/${parcours.slug}`}>
        <div className="relative h-48 w-full overflow-hidden">
          {parcours.image ? (
            <>
              <Image
                src={parcours.image}
                alt={parcours.designation}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl font-bold text-white">
                {parcours.designation.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          {/* Badge questions */}
          <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-white shadow-md">
            {parcours.questions} Q
          </div>
        </div>
      </Link>

      {/* Contenu */}
      <div className="p-5 xl:p-6">
        <Link href={`/parcours/${parcours.slug}`}>
          <h3 className="mb-2 text-lg font-semibold text-black dark:text-white xl:text-xl">
            {parcours.designation}
          </h3>
          <p className="mb-3 line-clamp-2 text-sm text-waterloo">
            {parcours.description}
          </p>
        </Link>

        {parcours.categories && parcours.categories.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {parcours.categories.slice(0, 3).map((cat) => (
              <span
                key={cat._id}
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] text-primary dark:bg-primary/20"
              >
                {cat.designation}
              </span>
            ))}
            {parcours.categories.length > 3 && (
              <span className="text-[11px] text-waterloo">+{parcours.categories.length - 3}</span>
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
              href={`/parcours/${parcours.slug}`}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white shadow-md transition hover:bg-primaryho"
            >
              <Eye className="h-3.5 w-3.5" /> Découvrir
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SingleParcours;