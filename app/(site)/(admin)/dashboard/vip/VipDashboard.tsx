"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Clock,
  Crown,
  Loader2,
  Users,
  BarChart3,
  Target,
} from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

export default function VipDashboard() {
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
    { label: "Questions OK / Total", value: `${data.averages.questions.ok}/${data.averages.questions.total}`, icon: <Target className="h-5 w-5" />, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Score total", value: `${data.stats.scoreTotal} pts`, icon: <TrendingUp className="h-5 w-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: "Précision", value: `${data.stats.precision}%`, icon: <Crown className="h-5 w-5" />, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
    { label: "Équipe", value: data.team ? data.team.designation : "Aucune", icon: <Users className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
  ] : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
            <Trophy className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard Compétiteur</h1>
            <p className="text-waterloo">Affrontez les meilleurs et remportez des lots</p>
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

          {/* Top & classement — ligne pleine largeur */}
          <div className="grid gap-6 lg:grid-cols-1">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Top & classement</h2>
              </div>
              <div className="rounded-xl border border-stroke bg-alabaster p-4 dark:border-strokedark dark:bg-strokedark">
                <p className="text-sm text-waterloo">Votre position</p>
                <p className="mt-1 text-2xl font-bold text-black dark:text-white">{data?.top.value || '—'}</p>
                <p className="mt-1 text-sm text-waterloo">{data?.top.detail || 'Pas encore classé'}</p>
              </div>
              <div className="mt-4 space-y-2">
                {data?.leaderboard?.slice(0, 5).map((player) => (
                  <div key={player._id} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                    <span className="font-medium text-black dark:text-white">#{player.rank} {player.pseudo}</span>
                    <span className="text-waterloo">{player.score} pts</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Chart 2/3 + Activité 1/3 */}
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        </>
      )}
    </div>
  );
}