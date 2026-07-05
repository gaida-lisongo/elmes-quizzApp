"use client";

import { motion } from "framer-motion";
import {
  Zap,
  Route,
  Clock,
  TrendingUp,
  Target,
  Medal,
  BookOpen,
  Swords,
} from "lucide-react";

const stats = [
  {
    label: "Parcours complétés",
    value: "0",
    icon: <Route className="h-5 w-5" />,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10",
  },
  {
    label: "Score total",
    value: "0 pts",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-500/10",
  },
  {
    label: "Meilleur temps",
    value: "--:--",
    icon: <Clock className="h-5 w-5" />,
    color: "text-amber-500",
    bg: "bg-amber-50 dark:bg-amber-500/10",
  },
  {
    label: "Classement",
    value: "-#",
    icon: <Medal className="h-5 w-5" />,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-500/10",
  },
];

const quickActions = [
  {
    title: "Nouveau parcours",
    desc: "Démarrer un parcours chronométré",
    icon: <Route className="h-8 w-8" />,
    color: "text-purple-500",
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-200 dark:border-purple-500/20",
  },
  {
    title: "Mes parcours",
    desc: "Voir mes parcours en cours",
    icon: <BookOpen className="h-8 w-8" />,
    color: "text-indigo-500",
    gradient: "from-indigo-500/10 to-indigo-500/5",
    border: "border-indigo-200 dark:border-indigo-500/20",
  },
  {
    title: "Défier",
    desc: "Lancer un défi à un ami",
    icon: <Swords className="h-8 w-8" />,
    color: "text-rose-500",
    gradient: "from-rose-500/10 to-rose-500/5",
    border: "border-rose-200 dark:border-rose-500/20",
  },
  {
    title: "Classement",
    desc: "Voir le classement général",
    icon: <Medal className="h-8 w-8" />,
    color: "text-amber-500",
    gradient: "from-amber-500/10 to-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/20",
  },
];

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

export default function AdvancedDashboard() {
  return (
    <div className="space-y-8">
      {/* En-tête */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
            <Zap className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">
              Dashboard Génie
            </h1>
            <p className="text-waterloo">
              Parcourez les défis et dominez les classements
            </p>
          </div>
        </div>
      </motion.div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-stroke bg-white p-5 shadow-solid-5 transition-all duration-300 hover:shadow-lg dark:border-strokedark dark:bg-blacksection"
          >
            <div
              className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}
            >
              <div className={stat.color}>{stat.icon}</div>
            </div>
            <p className="text-2xl font-bold text-black dark:text-white">
              {stat.value}
            </p>
            <p className="text-sm text-waterloo">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Actions rapides */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-black dark:text-white">
          Actions rapides
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, i) => (
            <motion.button
              key={action.title}
              custom={i + 4}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className={`group relative overflow-hidden rounded-2xl border ${action.border} bg-gradient-to-br ${action.gradient} p-6 text-left transition-all duration-300 hover:shadow-lg dark:bg-blacksection`}
            >
              <div className={`mb-4 ${action.color}`}>{action.icon}</div>
              <h3 className="mb-1 font-semibold text-black dark:text-white">
                {action.title}
              </h3>
              <p className="text-sm text-waterloo">{action.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Activité récente */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
      >
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">
            Activité récente
          </h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Route className="mx-auto mb-3 h-12 w-12 text-waterloo" />
            <p className="text-waterloo">
              Aucun parcours effectué pour le moment
            </p>
            <p className="mt-1 text-sm text-waterloo/70">
              Commencez un parcours pour apparaître ici
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}