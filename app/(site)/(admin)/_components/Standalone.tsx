"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, Trophy, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getPlayerMetricsAction, type PlayerMetricsData } from "@/actions/player.metrics.actions";

export default function StandaloneTable() {
  const [data, setData] = useState<PlayerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await getPlayerMetricsAction();
      if (res.success) setData(res.data || null);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!data?.leaderboard) return [];
    if (!search.trim()) return data.leaderboard;
    const q = search.toLowerCase();
    return data.leaderboard.filter((p) => p.pseudo.toLowerCase().includes(q));
  }, [data, search]);

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold text-black dark:text-white">Classement Standalone</h2>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-waterloo" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Rechercher un joueur…"
            className="w-full rounded-lg border border-stroke bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-strokedark dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stroke text-xs font-medium uppercase text-waterloo dark:border-strokedark">
              <th className="pb-3 pr-4">#</th>
              <th className="pb-3 pr-4">Joueur</th>
              <th className="pb-3 pr-4">Score</th>
              <th className="pb-3 pr-4">Parties</th>
              <th className="pb-3 pr-4">Précision</th>
              <th className="pb-3">Niveau</th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-waterloo">Aucun joueur trouvé.</td></tr>
            ) : paged.map((player) => (
              <tr key={player._id} className="border-b border-stroke last:border-0 dark:border-strokedark">
                <td className="py-3 pr-4 font-bold text-black dark:text-white">#{player.rank}</td>
                <td className="py-3 pr-4 font-medium text-black dark:text-white">{player.pseudo}</td>
                <td className="py-3 pr-4 font-semibold text-primary">{player.score}</td>
                <td className="py-3 pr-4 text-waterloo">{player.parties}</td>
                <td className="py-3 pr-4 text-waterloo">{player.precision}%</td>
                <td className="py-3 text-waterloo">Niv. {player.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded-lg p-1 text-waterloo hover:bg-stroke disabled:opacity-30 dark:hover:bg-strokedark">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-waterloo">{page + 1}/{totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}
            className="rounded-lg p-1 text-waterloo hover:bg-stroke disabled:opacity-30 dark:hover:bg-strokedark">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
