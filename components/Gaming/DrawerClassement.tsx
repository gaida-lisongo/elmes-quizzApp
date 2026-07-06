'use client';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, Medal, User, Loader2, Star } from "lucide-react";
import { getClassementAction } from "@/actions/enrollment.actions";

interface ClassementItem {
  _id: string;
  totalScore: number;
  partiesJouees: number;
  meilleurScore: number;
  pseudo: string;
  photo?: string;
  telephone: string;
  type: string;
  level: number;
}

interface DrawerClassementProps {
  open: boolean;
  onClose: () => void;
}

const rankIcons = [
  <Trophy key="1" className="h-5 w-5 text-yellow-500" />,
  <Medal key="2" className="h-5 w-5 text-gray-400" />,
  <Medal key="3" className="h-5 w-5 text-amber-700" />,
];

const rankColors = [
  "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20",
  "border-gray-300 bg-gray-50 dark:bg-gray-800/30",
  "border-amber-600 bg-amber-50 dark:bg-amber-900/20",
  "border-stroke bg-white dark:bg-blacksection",
  "border-stroke bg-white dark:bg-blacksection",
];

export default function DrawerClassement({ open, onClose }: DrawerClassementProps) {
  const [classement, setClassement] = useState<ClassementItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getClassementAction()
      .then((res) => {
        if (res.success && res.classement) {
          setClassement(res.classement);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-solid-4 dark:bg-blacksection"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stroke bg-white px-6 py-4 dark:border-strokedark dark:bg-blacksection">
              <div className="flex items-center gap-3">
                <Trophy className="h-6 w-6 text-yellow-500" />
                <div>
                  <h3 className="text-lg font-bold text-black dark:text-white">
                    Classement
                  </h3>
                  <p className="text-xs text-waterloo">Top 5 des meilleurs joueurs</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-stroke dark:hover:bg-strokedark"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="mt-4 text-sm text-waterloo">Chargement du classement...</p>
                </div>
              ) : classement.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Star className="h-12 w-12 text-waterloo/40" />
                  <p className="mt-4 font-medium text-black dark:text-white">
                    Aucun classement disponible
                  </p>
                  <p className="mt-1 text-sm text-waterloo">
                    Soyez le premier à jouer et à apparaître ici !
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {classement.map((item, index) => (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className={`flex items-center gap-4 rounded-xl border p-4 ${rankColors[index] || rankColors[4]}`}
                    >
                      {/* Rang */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold text-black shadow-sm dark:bg-blacksection dark:text-white">
                        {index < 3 ? rankIcons[index] : <span>#{index + 1}</span>}
                      </div>

                      {/* Avatar / Pseudo */}
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-black dark:text-white">
                            {item.pseudo}
                          </p>
                          <p className="text-xs text-waterloo">
                            Niveau {item.level} · {item.type}
                          </p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          {item.totalScore}
                        </p>
                        <p className="text-[10px] text-waterloo">
                          {item.partiesJouees} partie{(item.partiesJouees || 0) > 1 ? "s" : ""}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}