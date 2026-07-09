"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  Gift,
  Link2,
  Loader2,
  Play,
  QrCode,
  Users,
} from "lucide-react";
import {
  getMyAffiliationMetricsAction,
  startAffiliateTrainingPartieAction,
} from "@/actions/affiliation.actions";
import { getAvailableCategoriesAction } from "@/actions/partie.actions";
import type { PartieActiveData } from "@/actions/partie.actions";
import GamePlayer from "@/components/Gaming/GamePlayer";
import ShareLink from "@/components/Common/ShareLink";

export default function Parrainages() {
  const [metrics, setMetrics] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [partie, setPartie] = useState<PartieActiveData | null>(null);

  const referralUrl = useMemo(() => {
    if (!metrics?.linkPath || typeof window === "undefined") return "";
    return `${window.location.origin}${metrics.linkPath}`;
  }, [metrics?.linkPath]);

  const load = async () => {
    setLoading(true);
    const [metricsRes, categoriesRes] = await Promise.all([
      getMyAffiliationMetricsAction(),
      getAvailableCategoriesAction(),
    ]);

    if (metricsRes.success) setMetrics(metricsRes.data);
    else toast.error(metricsRes.error || "Impossible de charger l'affiliation.");

    if (categoriesRes.success) setCategories(categoriesRes.categories || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!referralUrl) return;
    QRCode.toDataURL(referralUrl, { width: 180, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [referralUrl]);

  const handleStart = async (categorieId: string) => {
    setStarting(categorieId);
    try {
      const res = await startAffiliateTrainingPartieAction(categorieId);
      if (res.success && res.data) {
        setPartie(res.data);
      } else {
        toast.error(res.error || "Impossible de lancer la partie d'affiliation.");
      }
    } catch {
      toast.error("Erreur lors du lancement.");
    } finally {
      setStarting(null);
    }
  };

  if (partie) {
    return (
      <GamePlayer
        partie={partie}
        onFinish={async () => {
          await load();
        }}
        onCancel={() => setPartie(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-stroke bg-white p-10 dark:border-strokedark dark:bg-blacksection">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const canPlay = (metrics?.remainingAffiliateGames || 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="mb-5 flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-black dark:text-white">Affiliation</h2>
            <p className="text-sm text-waterloo">Suivi de vos affiliés et de vos parties d'entraînement obtenues.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            ["Affiliés", metrics?.validAffiliatesCount || 0],
            ["Parties obtenues", metrics?.totalGrantedAffiliateGames || 0],
            ["Parties utilisées", metrics?.usedAffiliateGames || 0],
            ["Parties restantes", metrics?.remainingAffiliateGames || 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-stroke p-4 dark:border-strokedark">
              <p className="text-2xl font-bold text-black dark:text-white">{String(value)}</p>
              <p className="text-xs text-waterloo">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-waterloo">
              <Link2 className="h-3.5 w-3.5" /> Code et lien
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">{metrics?.referralCode}</span>
              {referralUrl ? <ShareLink url={referralUrl} /> : null}
            </div>
            {referralUrl ? <p className="mt-3 break-all text-xs text-waterloo">{referralUrl}</p> : null}
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-stroke p-4 dark:border-strokedark">
            {qrDataUrl ? <img src={qrDataUrl} alt="QR code d'affiliation" className="h-24 w-24 rounded-lg border border-stroke p-1 dark:border-strokedark" /> : <QrCode className="h-10 w-10 text-waterloo" />}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-black dark:text-white">Jouer avec vos parties d'affiliation</h3>
        </div>

        {!canPlay ? (
          <div className="rounded-lg border border-stroke bg-alabaster p-4 text-sm text-waterloo dark:border-strokedark dark:bg-strokedark">
            <AlertCircle className="mb-2 h-5 w-5" />
            Aucune partie d'affiliation disponible.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {categories.map((cat) => (
              <button
                key={cat._id}
                onClick={() => handleStart(cat._id)}
                disabled={starting === cat._id}
                className="group flex items-center gap-3 rounded-xl border border-stroke bg-white p-4 text-left transition-all hover:border-primary hover:shadow-md disabled:opacity-60 dark:border-strokedark dark:bg-blacksection"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-black dark:text-white">{cat.designation}</p>
                  {cat.description ? <p className="truncate text-xs text-waterloo">{cat.description}</p> : null}
                </div>
                {starting === cat._id ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <ChevronRight className="h-5 w-5 text-waterloo group-hover:text-primary" />}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-stroke bg-white p-6 shadow-solid-5 dark:border-strokedark dark:bg-blacksection">
        <div className="mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-black dark:text-white">Mes affiliés</h3>
        </div>
        {metrics?.affiliates?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stroke text-xs uppercase text-waterloo dark:border-strokedark">
                  <th className="pb-3 pr-4">Pseudo</th>
                  <th className="pb-3 pr-4">Inscription</th>
                  <th className="pb-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {metrics.affiliates.map((affiliate: any) => (
                  <tr key={affiliate.id} className="border-b border-stroke last:border-0 dark:border-strokedark">
                    <td className="py-3 pr-4 font-medium text-black dark:text-white">{affiliate.pseudo}</td>
                    <td className="py-3 pr-4 text-waterloo">{affiliate.createdAt ? new Date(affiliate.createdAt).toLocaleDateString("fr-FR") : "-"}</td>
                    <td className="py-3">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-400">Validé</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-waterloo">Aucun affilié pour le moment.</p>
        )}
      </section>
    </motion.div>
  );
}
