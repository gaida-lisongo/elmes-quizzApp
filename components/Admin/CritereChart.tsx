"use client";

import { motion } from "framer-motion";
import { BarChart3, Medal, DollarSign, Users, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { MetricsData } from "./MetriqueLayout";
import { useState } from "react";

interface CritereChartProps {
  criteres: MetricsData['topEnrollements'] & Array<any>;
}

export default function CritereChart({ criteres }: CritereChartProps) {
  const [selected, setSelected] = useState<any>(null);

  if (!criteres || criteres.length === 0) {
    return (
      <div className="rounded-xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <p className="text-center text-sm text-waterloo">Aucun critère pour le moment</p>
      </div>
    );
  }

  const critere = selected || criteres[0];

  const paliers = [
    { key: 'third', label: '3e place', points: critere.third?.[0]?.points || 0, color: 'bg-amber-500', count: 6, qualified: (critere.third || []).filter((e: any) => e.playerId || e.equipeId).length, bg: 'bg-amber-50 dark:bg-amber-500/10', textColor: 'text-amber-700' },
    { key: 'second', label: '2e place', points: critere.second?.[0]?.points || 0, color: 'bg-purple-500', count: 4, qualified: (critere.second || []).filter((e: any) => e.playerId || e.equipeId).length, bg: 'bg-purple-50 dark:bg-purple-500/10', textColor: 'text-purple-700' },
    { key: 'first', label: '1re place', points: critere.first?.[0]?.points || 0, color: 'bg-emerald-500', count: 2, qualified: (critere.first || []).filter((e: any) => e.playerId || e.equipeId).length, bg: 'bg-emerald-50 dark:bg-emerald-500/10', textColor: 'text-emerald-700' },
  ];

  return (
    <div className="rounded-xl border border-stroke bg-white p-5 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
          <Medal className="h-5 w-5 text-primary" /> Classement
        </h3>
        <select
          value={critere._id}
          onChange={(e) => setSelected(criteres.find((c: any) => c._id === e.target.value))}
          className="rounded-lg border border-stroke bg-transparent px-3 py-1.5 text-xs dark:border-strokedark dark:text-white"
        >
          {criteres.map((c: any) => (
            <option key={c._id} value={c._id}>{c.designation}</option>
          ))}
        </select>
      </div>

      {paliers.map((p) => {
        const percent = p.count > 0 ? Math.round((p.qualified / p.count) * 100) : 0;
        return (
          <div key={p.key} className="mb-3">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className={`font-medium ${p.textColor}`}>{p.label}</span>
              <span className="text-waterloo">{p.qualified}/{p.count}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
              <div className={`h-full rounded-full transition-all ${p.color}`} style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-0.5 text-xs text-waterloo">{p.points} points requis</p>
          </div>
        );
      })}
    </div>
  );
}