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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Espace vide pour future extension */}
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