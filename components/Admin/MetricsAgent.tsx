"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Users, Shield, UserCheck, Medal, Activity } from "lucide-react";
import MetriqueLayout, { type MetricsData } from "./MetriqueLayout";
import { getMetricsAgentAction, type MetricsAgentData } from "@/actions/metrics.actions";

const TYPE_COLORS: Record<string, string> = {
  standalone: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
  advanced: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
  vip: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30",
  equipesOk: "text-green-600 bg-green-100 dark:bg-green-900/30",
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  standalone: <Users className="h-5 w-5" />,
  advanced: <Shield className="h-5 w-5" />,
  vip: <Medal className="h-5 w-5" />,
  equipesOk: <UserCheck className="h-5 w-5" />,
};

interface MetricsAgentProps {
  role: "ADMIN" | "MOD";
}

export default function MetricsAgent({ role }: MetricsAgentProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMetricsAgentAction();
      if (res.success && res.data) {
        const d: MetricsAgentData = res.data;
        setData({
          moyennesCards: [
            {
              label: "STANDALONE", count: d.moyennes.standalone.count,
              total: d.moyennes.standalone.total, percent: d.moyennes.standalone.percent,
              icon: TYPE_ICONS.standalone, color: TYPE_COLORS.standalone,
            },
            {
              label: "ADVANCED", count: d.moyennes.advanced.count,
              total: d.moyennes.advanced.total, percent: d.moyennes.advanced.percent,
              icon: TYPE_ICONS.advanced, color: TYPE_COLORS.advanced,
            },
            {
              label: "VIP", count: d.moyennes.vip.count,
              total: d.moyennes.vip.total, percent: d.moyennes.vip.percent,
              icon: TYPE_ICONS.vip, color: TYPE_COLORS.vip,
            },
            {
              label: "Équipes OK", count: d.moyennes.equipesOk.count,
              total: d.moyennes.equipesOk.total, percent: d.moyennes.equipesOk.percent,
              icon: TYPE_ICONS.equipesOk, color: TYPE_COLORS.equipesOk,
            },
          ],
          chart: d.chart,
          topEnrollements: d.topEnrollements,
          players: d.players,
          equipes: d.equipes,
          totalPlayers: d.totalPlayers,
          totalEquipes: d.totalEquipes,
        });
      }
    } catch {
      // Ignorer
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-waterloo">Chargement des métriques...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Activity className="h-10 w-10 text-waterloo/40" />
        <p className="mt-3 text-sm text-waterloo">Impossible de charger les métriques.</p>
      </div>
    );
  }

  return (
    <MetriqueLayout
      data={data}
      role={role}
      onPlayerAction={(player) => {
        // Future: ouvrir modal bonus/niveau pour ce joueur
        console.log("Player action:", player.pseudo);
      }}
      onEquipeAction={(equipe) => {
        // Future: gérer équipe (vérifier paiement, révoquer membre)
        console.log("Equipe action:", equipe.designation);
      }}
    />
  );
}