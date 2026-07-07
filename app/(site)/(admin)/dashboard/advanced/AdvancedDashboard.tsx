"use client";

import { useEffect, useState } from "react";
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
  Loader2,
} from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";

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
  const [data, setData] = useState<PlayerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getPlayerMetricsAction();
      if (res.success) setData(res.data || null);
      setLoading(false);
    };
    load();
  }, []);

  const stats = data ? [
    { label: "Sessions suivies", value: `${data.sessions.length}`, icon: <Route className="h-5 w-5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" },
    { label: "Score total", value: `${data.stats.scoreTotal} pts`, icon: <TrendingUp className="h-5 w-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: "Précision", value: `${data.stats.precision}%`, icon: <Target className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { label: "Niveau actuel", value: `Niv. ${data.stats.level}`, icon: <Medal className="h-5 w-5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" },
  ] : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-500/10">
            <Zap className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard Génie</h1>
            <p className="text-waterloo">Parcourez les défis et dominez les classements</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div key={stat.label} custom={i} variants={fadeInUp} initial="hidden" animate="visible" className="rounded-2xl border border-stroke bg-white p-5 shadow-solid-5 transition-all duration-300 hover:shadow-lg dark:border-strokedark dark:bg-blacksection">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                  <div className={stat.color}>{stat.icon}</div>
                </div>
                <p className="text-2xl font-bold text-black dark:text-white">{stat.value}</p>
                <p className="text-sm text-waterloo">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div>
            <h2 className="mb-4 text-xl font-semibold text-black dark:text-white">Actions rapides</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action, i) => (
                <motion.button key={action.title} custom={i + 4} variants={fadeInUp} initial="hidden" animate="visible" className={`group relative overflow-hidden rounded-2xl border ${action.border} bg-gradient-to-br ${action.gradient} p-6 text-left transition-all duration-300 hover:shadow-lg dark:bg-blacksection`}>
                  <div className={`mb-4 ${action.color}`}>{action.icon}</div>
                  <h3 className="mb-1 font-semibold text-black dark:text-white">{action.title}</h3>
                  <p className="text-sm text-waterloo">{action.desc}</p>
                </motion.button>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-black dark:text-white">Performance par session</h2>
            </div>
            {data?.sessions?.length ? (
              <div className="space-y-2">
                {data.sessions.map((session) => (
                  <div key={session.label} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                    <span className="text-waterloo">{session.label}</span>
                    <span className="font-semibold text-primary">{session.count} inscription(s)</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Route className="mx-auto mb-3 h-12 w-12 text-waterloo" />
                  <p className="text-waterloo">Aucun parcours effectué pour le moment</p>
                  <p className="mt-1 text-sm text-waterloo/70">Commencez un parcours pour apparaître ici</p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}