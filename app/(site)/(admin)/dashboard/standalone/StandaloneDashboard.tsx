"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Gamepad2,
  Ticket,
  TrendingUp,
  Clock,
  Star,
  Target,
  Sparkles,
  Loader2,
  BarChart3,
  Trophy,
  Award,
  ChevronRight,
} from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";

const quickActions = [
  {
    title: "Jouer une partie",
    desc: "Démarrer un quiz en solo",
    icon: <Gamepad2 className="h-8 w-8" />,
    color: "text-emerald-500",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-200 dark:border-emerald-500/20",
  },
  {
    title: "Mes tickets",
    desc: "Voir mes tickets disponibles",
    icon: <Ticket className="h-8 w-8" />,
    color: "text-amber-500",
    gradient: "from-amber-500/10 to-amber-500/5",
    border: "border-amber-200 dark:border-amber-500/20",
  },
  {
    title: "Classement",
    desc: "Voir mon classement",
    icon: <Star className="h-8 w-8" />,
    color: "text-purple-500",
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-200 dark:border-purple-500/20",
  },
  {
    title: "Défier",
    desc: "Inviter un ami",
    icon: <Sparkles className="h-8 w-8" />,
    color: "text-pink-500",
    gradient: "from-pink-500/10 to-pink-500/5",
    border: "border-pink-200 dark:border-pink-500/20",
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

export default function StandaloneDashboard() {
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

  const stats = data
    ? [
        { label: "Questions OK / Total", value: `${data.averages.questions.ok}/${data.averages.questions.total}`, icon: <Target className="h-5 w-5" />, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        { label: "Catégories OK / Total", value: `${data.averages.categories.ok}/${data.averages.categories.total}`, icon: <Award className="h-5 w-5" />, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { label: "Parties OK / Parties", value: `${data.averages.parties.ok}/${data.averages.parties.total}`, icon: <Gamepad2 className="h-5 w-5" />, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { label: "Niveau actuel / 3", value: `${data.averages.level.current}/${data.averages.level.total}`, icon: <TrendingUp className="h-5 w-5" />, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-500/10" },
      ]
    : [];

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
            <Brain className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white">Dashboard Intelligent</h1>
            <p className="text-waterloo">Bienvenue sur votre espace personnel</p>
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

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-black dark:text-white">Distribution par catégorie</h2>
              </div>
              {data?.categoryBreakdown?.length ? (
                <div className="space-y-3">
                  {data.categoryBreakdown.map((item) => (
                    <div key={item.categorie} className="rounded-lg border border-stroke px-3 py-2 dark:border-strokedark">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-black dark:text-white">{item.categorie}</span>
                        <span className="text-waterloo">{item.parties} parties</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(8, item.ok * 10)}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-waterloo">{item.ok} bonnes réponses</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-waterloo">Aucune donnée de catégorie disponible.</div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.7 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
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

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.8 }} className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-black dark:text-white">Activité récente</h2>
            </div>
            {data?.recentParties?.length ? (
              <div className="space-y-3">
                {data.recentParties.map((party) => (
                  <div key={party._id} className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark">
                    <div>
                      <p className="font-medium text-black dark:text-white">{party.categorie}</p>
                      <p className="text-waterloo">{new Date(party.createdAt).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{party.note} pts</p>
                      <p className="text-xs text-waterloo">{party.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Brain className="mx-auto mb-3 h-12 w-12 text-waterloo" />
                  <p className="text-waterloo">Aucune partie jouée pour le moment</p>
                  <p className="mt-1 text-sm text-waterloo/70">Lancez-vous et commencez à jouer !</p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}