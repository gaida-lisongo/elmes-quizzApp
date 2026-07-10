"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ApexCharts from "apexcharts";
import { motion } from "framer-motion";
import { AlertCircle, BarChart3, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import {
  getSessionRevenueOverviewAction,
  type SessionRevenueOverviewRow,
} from "@/actions/metrics.actions";

export default function SessionRevenueOverview() {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [sessions, setSessions] = useState<SessionRevenueOverviewRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) || sessions[0] || null,
    [sessions, selectedSessionId],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const res = await getSessionRevenueOverviewAction();
      if (res.success && res.data) {
        setSessions(res.data.sessions || []);
        setSelectedSessionId(res.data.selectedSessionId || res.data.sessions?.[0]?.sessionId || null);
      } else {
        setError(res.error || "Impossible de charger les revenus de session.");
      }
      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!selectedSession) {
      chartRef.current.innerHTML = "";
      return;
    }

    const distribution = selectedSession.distribution || [];
    if (distribution.length === 0) {
      chartRef.current.innerHTML = "";
      return;
    }

    const chart = new ApexCharts(chartRef.current, {
      chart: {
        type: "donut",
        height: 320,
        toolbar: { show: false },
      },
      series: distribution.map((row) => row.amount),
      labels: distribution.map((row) => row.resourceTitle),
      colors: ["#2563eb", "#7c3aed", "#0f766e", "#ea580c", "#be123c", "#4b5563"],
      legend: { show: false },
      dataLabels: {
        enabled: true,
        formatter: (value: number) => `${Math.round(value)}%`,
      },
      stroke: { width: 2 },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: { show: true },
              value: {
                show: true,
                formatter: (value: string) => `${Number(value).toLocaleString("fr-FR")} FC`,
              },
              total: {
                show: true,
                label: "Total encaissé",
                formatter: () => `${selectedSession.totalRevenue.toLocaleString("fr-FR")} FC`,
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value.toLocaleString("fr-FR")} FC`,
        },
      },
    });

    chart.render();

    return () => {
      chart.destroy();
    };
  }, [selectedSession]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <div className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="flex items-center gap-3 text-waterloo">
          <CalendarDays className="h-5 w-5" />
          <p>Aucune session récente disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-semibold text-black dark:text-white">Revenus par session</h2>
            <p className="text-sm text-waterloo">Revenus par session et distribution par ressource</p>
          </div>
        </div>
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            const res = await getSessionRevenueOverviewAction();
            if (res.success && res.data) {
              setSessions(res.data.sessions || []);
              setSelectedSessionId(res.data.selectedSessionId || res.data.sessions?.[0]?.sessionId || null);
              setError(null);
            } else {
              setError(res.error || "Impossible de charger les revenus de session.");
            }
            setLoading(false);
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm text-black transition hover:border-primary dark:border-strokedark dark:text-white"
        >
          <RefreshCw className="h-4 w-4" />
          Actualiser
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          {sessions.map((session) => {
            const active = session.sessionId === selectedSession?.sessionId;
            return (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => setSelectedSessionId(session.sessionId)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-stroke hover:border-primary/60 dark:border-strokedark"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-black dark:text-white">{session.name}</p>
                    <p className="text-xs text-waterloo">
                      {session.type} • {session.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {session.totalRevenue.toLocaleString("fr-FR")} FC
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-waterloo">
                  <span>{session.totalEnrollments} enrôlements</span>
                  <span>{session.validatedPayments} validés</span>
                  <span>{session.pendingPayments} pending</span>
                  <span>{session.failedPayments} échoués</span>
                </div>
                <p className="mt-3 text-xs text-waterloo">
                  {session.startDate ? new Date(session.startDate).toLocaleDateString("fr-FR") : "—"}
                  {" "}→{" "}
                  {session.endDate ? new Date(session.endDate).toLocaleDateString("fr-FR") : "—"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {selectedSession ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Total encaissé", value: `${selectedSession.totalRevenue.toLocaleString("fr-FR")} FC` },
                  { label: "Enrôlements", value: String(selectedSession.totalEnrollments) },
                  { label: "Paiements validés", value: String(selectedSession.validatedPayments) },
                  { label: "Paiements pending", value: String(selectedSession.pendingPayments) },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                    <p className="text-xs uppercase text-waterloo">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold text-black dark:text-white">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-black dark:text-white">Revenus par ressource</h3>
                    <p className="text-xs text-waterloo">Session sélectionnée : {selectedSession.name}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {selectedSession.totalRevenue.toLocaleString("fr-FR")} FC
                  </span>
                </div>
                <div ref={chartRef} />
              </div>

              <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                <h3 className="mb-3 text-sm font-semibold uppercase text-waterloo">Distribution</h3>
                {selectedSession.distribution.length ? (
                  <div className="space-y-2">
                    {selectedSession.distribution.map((row) => (
                      <div key={`${row.resourceType}-${row.resourceId}`} className="flex items-center justify-between rounded-lg bg-alabaster px-3 py-2 text-sm dark:bg-strokedark">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-black dark:text-white">{row.resourceTitle}</p>
                          <p className="text-xs text-waterloo">
                            {row.resourceType} • {row.countEnrollments} enrôlement(s) • {row.countPayments} paiement(s)
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-primary">
                          {row.amount.toLocaleString("fr-FR")} FC
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-waterloo">Aucune recette validée pour cette session.</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-stroke p-6 text-sm text-waterloo dark:border-strokedark">
              Aucune session sélectionnée.
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
