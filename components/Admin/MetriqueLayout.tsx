"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users, BarChart3, DollarSign, Medal, ChevronLeft, ChevronRight,
} from "lucide-react";

/* ================================================================
   Types génériques (agnostiques)
   ================================================================ */
export interface CritereDisplay {
  _id: string;
  designation: string;
  ressource: string;
  status: boolean;
  ressourceId: { _id: string; designation: string };
  first: Array<{points: number; playerId?: string; equipeId?: string}>;
  second: Array<{points: number; playerId?: string; equipeId?: string}>;
  third: Array<{points: number; playerId?: string; equipeId?: string}>;
}

/* ================================================================
   Types génériques (agnostiques)
   ================================================================ */
export interface MetricMoyennesCard {
  label: string;
  count: number;
  total: number;
  percent: number;
  icon: React.ReactNode;
  color: string;
}

export interface ChartCategorieItem {
  categorie: string;
  ok: number;
  no: number;
  total: number;
}

export interface TopEnrollementItem {
  categorie: string;
  count: number;
  revenue: number;
}

export interface PlayerRowItem {
  _id: string;
  pseudo: string;
  telephone: string;
  type: string;
  level: number;
  totalScore: number;
  partiesJouees: number;
  partiesGagnees: number;
}

export interface EquipeRowItem {
  _id: string;
  designation: string;
  chefPseudo: string;
  membresCount: number;
  paymentStatus: string;
  matchsWin: number;
  soldeUsd: number;
}

export interface MetricsData {
  moyennesCards: MetricMoyennesCard[];
  chart: ChartCategorieItem[];
  topEnrollements: TopEnrollementItem[];
  criteres?: CritereDisplay[];
  players?: PlayerRowItem[];
  equipes?: EquipeRowItem[];
  totalPlayers?: number;
  totalEquipes?: number;
}

interface MetriqueLayoutProps {
  data: MetricsData;
  role: "ADMIN" | "MOD" | "PLAYER";
  onPlayerAction?: (player: PlayerRowItem) => void;
  onEquipeAction?: (equipe: EquipeRowItem) => void;
}

/* ================================================================
   Composant principal (totalement agnostique)
   ================================================================ */
export default function MetriqueLayout({
  data,
  role,
  onPlayerAction,
  onEquipeAction,
}: MetriqueLayoutProps) {
  const { moyennesCards, chart, topEnrollements, criteres, players, equipes } = data;

  // Pagination locale
  const [playerPage, setPlayerPage] = useState(0);
  const pageSize = 10;
  const pagedPlayers = players?.slice(playerPage * pageSize, (playerPage + 1) * pageSize) || [];
  const totalPlayerPages = Math.ceil((players?.length || 0) / pageSize);

  const paymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      SUCCES: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      EN_ATTENTE: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      ECHEC: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      NONE: "bg-gray-100 text-gray-500 dark:bg-gray-800",
    };
    return styles[status] || "bg-gray-100 text-gray-500";
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Cartes de moyennes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {moyennesCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-stroke bg-white p-4 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color}`}>
                {card.icon}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {card.percent}%
              </span>
            </div>
            <p className="text-2xl font-bold text-black dark:text-white">
              {card.count.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-waterloo">
              {card.label} <span className="text-xs text-waterloo/60">/ {card.total.toLocaleString()}</span>
            </p>
          </motion.div>
        ))}
      </div>

      {/* Row 2: Chart (2/3) + Top enrollements (1/3) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart — 2/3 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <BarChart3 className="h-5 w-5 text-primary" /> Réponses par catégorie
              </h3>
              <p className="text-xs text-waterloo">Bonnes et mauvaises réponses</p>
            </div>
          </div>

          {chart.length === 0 ? (
            <p className="py-8 text-center text-sm text-waterloo">Aucune donnée disponible</p>
          ) : (
            <div className="space-y-4 pt-2">
              {chart.map((d) => {
                const okPercent = d.total > 0 ? (d.ok / d.total) * 100 : 0;
                const noPercent = d.total > 0 ? (d.no / d.total) * 100 : 0;
                return (
                  <div key={d.categorie}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-black dark:text-white">{d.categorie}</span>
                      <span className="text-waterloo">{d.total} réponses</span>
                    </div>
                    <div className="flex h-6 w-full overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white bg-green-500 transition-all"
                        style={{ width: `${okPercent}%` }}
                      >
                        {okPercent > 10 ? `${Math.round(okPercent)}%` : ""}
                      </div>
                      <div
                        className="flex items-center justify-center text-[10px] font-bold text-white bg-red-400 transition-all"
                        style={{ width: `${noPercent}%` }}
                      >
                        {noPercent > 10 ? `${Math.round(noPercent)}%` : ""}
                      </div>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[10px] text-waterloo">
                      <span className="text-green-600">{d.ok} bonnes</span>
                      <span className="text-red-500">{d.no} mauvaises</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Critères de récompense — 1/3 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
        >
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
            <Medal className="h-5 w-5 text-primary" /> Critères de récompense
          </h3>
          {data.criteres && data.criteres.length > 0 ? (
            <div className="space-y-3">
              {data.criteres.map((critere: any, i: number) => (
                <div key={critere._id} className="rounded-lg border border-stroke bg-alabaster p-2.5 dark:border-strokedark dark:bg-strokedark">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      critere.status ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {critere.status ? '✓' : '✗'}
                    </div>
                    <p className="text-sm font-medium text-black dark:text-white truncate flex-1">{critere.designation}</p>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-waterloo">
                    <span className="text-amber-600">🥉 {critere.third?.filter((e: any) => e.playerId || e.equipeId).length || 0}/6</span>
                    <span className="text-purple-600">🥈 {critere.second?.filter((e: any) => e.playerId || e.equipeId).length || 0}/4</span>
                    <span className="text-emerald-600">🏆 {critere.first?.filter((e: any) => e.playerId || e.equipeId).length || 0}/2</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-waterloo">{(critere.ressourceId as any)?.designation || critere.ressource}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-waterloo">Aucun critère défini</p>
          )}
        </motion.div>
      </div>

      {/* Row 3: DataTable */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
      >
        {role === "ADMIN" ? (
          /* Table des équipes */
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <Medal className="h-5 w-5 text-primary" /> Équipes ({data.totalEquipes || equipes?.length || 0})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stroke text-xs font-medium uppercase text-waterloo dark:border-strokedark">
                    <th className="pb-3 pr-4">Équipe</th>
                    <th className="pb-3 pr-4">Chef</th>
                    <th className="pb-3 pr-4">Membres</th>
                    <th className="pb-3 pr-4">Paiement</th>
                    <th className="pb-3 pr-4">Matchs gagnés</th>
                    <th className="pb-3 pr-4">Solde</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(!equipes || equipes.length === 0) ? (
                    <tr><td colSpan={7} className="py-8 text-center text-waterloo">Aucune équipe</td></tr>
                  ) : equipes.map((eq) => (
                    <tr key={eq._id} className="border-b border-stroke last:border-0 dark:border-strokedark">
                      <td className="py-3 pr-4 font-medium text-black dark:text-white">{eq.designation}</td>
                      <td className="py-3 pr-4 text-waterloo">{eq.chefPseudo}</td>
                      <td className="py-3 pr-4 text-waterloo">{eq.membresCount}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${paymentBadge(eq.paymentStatus)}`}>
                          {eq.paymentStatus === "SUCCES" ? "Payé" : eq.paymentStatus === "NONE" ? "—" : eq.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-semibold text-black dark:text-white">{eq.matchsWin}</td>
                      <td className="py-3 pr-4 text-waterloo">${eq.soldeUsd.toFixed(2)}</td>
                      <td className="py-3">
                        {onEquipeAction && (
                          <button onClick={() => onEquipeAction(eq)} className="text-xs text-primary hover:underline">Gérer</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* Table des joueurs (MOD ou PLAYER) */
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <Users className="h-5 w-5 text-primary" /> Joueurs ({data.totalPlayers || players?.length || 0})
              </h3>
              {totalPlayerPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={playerPage === 0}
                    onClick={() => setPlayerPage((p) => Math.max(0, p - 1))}
                    className="rounded-lg p-1 text-waterloo hover:bg-stroke disabled:opacity-30 dark:hover:bg-strokedark"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs text-waterloo">{playerPage + 1}/{totalPlayerPages}</span>
                  <button
                    disabled={playerPage >= totalPlayerPages - 1}
                    onClick={() => setPlayerPage((p) => p + 1)}
                    className="rounded-lg p-1 text-waterloo hover:bg-stroke disabled:opacity-30 dark:hover:bg-strokedark"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stroke text-xs font-medium uppercase text-waterloo dark:border-strokedark">
                    <th className="pb-3 pr-4">Joueur</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Niveau</th>
                    <th className="pb-3 pr-4">Score total</th>
                    <th className="pb-3 pr-4">Parties jouées</th>
                    <th className="pb-3 pr-4">Gagnées</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPlayers.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-waterloo">Aucun joueur</td></tr>
                  ) : pagedPlayers.map((p) => (
                    <tr key={p._id} className="border-b border-stroke last:border-0 dark:border-strokedark">
                      <td className="py-3 pr-4 font-medium text-black dark:text-white">{p.pseudo}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{p.type}</span>
                      </td>
                      <td className="py-3 pr-4 text-waterloo">Niv. {p.level}</td>
                      <td className="py-3 pr-4 font-semibold text-primary">{p.totalScore}</td>
                      <td className="py-3 pr-4 text-waterloo">{p.partiesJouees}</td>
                      <td className="py-3 pr-4 text-waterloo">{p.partiesGagnees}</td>
                      <td className="py-3">
                        {onPlayerAction && (
                          <button onClick={() => onPlayerAction(p)} className="text-xs text-primary hover:underline">Bonus</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}