"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Activity, Target, Award } from "lucide-react";
import { getCurrentUserDetailed } from "@/actions/auth.actions";
import ProfileUser from "@/components/Admin/ProfileUser";
import MetriqueLayout from "@/components/Admin/MetriqueLayout";
import MetricsAgent from "@/components/Admin/MetricsAgent";
import Enrollements from "@/components/Admin/Enrollements";
import QuestionsAdmin from "@/components/Admin/QuestionsAdmin";

export type UserRole = "ADMIN" | "MOD" | "PLAYER";
export type PlayerType = "STANDALONE" | "ADVANCED" | "VIP";

export interface MenuTab {
  id: string;
  name: string;
}

const USER_MENU: { account: string; menu: MenuTab[] }[] = [
  {
    account: "MOD",
    menu: [
      { id: "metriques", name: "Métriques" },
      { id: "questions", name: "Questions" },
      { id: "enrollements", name: "Enrollements" },
    ],
  },
  {
    account: "ADMIN",
    menu: [
      { id: "metriques", name: "Métriques" },
      { id: "agents", name: "Agents" },
      { id: "enrollements", name: "Enrollements" },
    ],
  },
  {
    account: "STANDALONE",
    menu: [
      { id: "metriques", name: "Métriques" },
      { id: "parties", name: "Parties" },
      { id: "retraits", name: "Retraits" },
    ],
  },
  {
    account: "ADVANCED",
    menu: [
      { id: "metriques", name: "Métriques" },
      { id: "parcours", name: "Parcours" },
      { id: "retraits", name: "Retraits" },
    ],
  },
  {
    account: "VIP",
    menu: [
      { id: "metriques", name: "Métriques" },
      { id: "matchs", name: "Matchs" },
      { id: "retraits", name: "Retraits" },
    ],
  },
];

/**
 * Détermine la clé de menu en fonction du rôle et du type de joueur.
 * - ADMIN, MOD → utilisent leur rôle directement
 * - PLAYER → utilise le type de son profil (STANDALONE, ADVANCED, VIP)
 */
function resolveMenuKey(
  role: UserRole,
  playerType?: PlayerType | null
): string {
  if (role === "ADMIN") return "ADMIN";
  if (role === "MOD") return "MOD";
  // PLAYER : on utilise le type de joueur
  return playerType || "STANDALONE";
}

export default function AdminLayoutClient({
  children,
  agents,
  metriques,
  enrollements,
  serverRole,
  serverPlayerType,
}: {
  children: React.ReactNode;
  agents?: React.ReactNode;
  metriques?: React.ReactNode;
  enrollements?: React.ReactNode;
  serverRole: UserRole;
  serverPlayerType: PlayerType | null;
}) {
  const [currentTab, setCurrentTab] = useState("metriques");
  const [menuKey, setMenuKey] = useState<string>(
    resolveMenuKey(serverRole, serverPlayerType)
  );

  // Re-vérifier la session côté client au cas où
  useEffect(() => {
    async function checkSession() {
      try {
        const user = await getCurrentUserDetailed();
        if (user) {
          const role = user.role as UserRole;
          const pType =
            user.profile?.type === "PLAYER"
              ? (user.profile as any).level !== undefined
                ? serverPlayerType
                : null
              : null;
          // Si le profil est un Player, on récupère son type depuis la session
          if (user.profile && "type" in user.profile && user.profile.type === "PLAYER") {
            // Re-fetch avec plus de détails si besoin
          }
          setMenuKey(resolveMenuKey(role, serverPlayerType));
        }
      } catch {
        // Garder la valeur serveur par défaut
      }
    }
    checkSession();
  }, [serverPlayerType, serverRole]);

  const activeMenu =
    USER_MENU.find((u) => u.account === menuKey)?.menu || USER_MENU[1].menu;
  const TABS = activeMenu;

  // Données mock pour le fallback PLAYER
  const mockMetricsData = {
    moyennesCards: [
      { label: "Joueurs total", count: 1284, total: 1284, percent: 100, icon: <Users className="h-5 w-5" />, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
      { label: "Parties jouées", count: 8432, total: 10000, percent: 84, icon: <Activity className="h-5 w-5" />, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
      { label: "Score moyen", count: 72, total: 100, percent: 72, icon: <Target className="h-5 w-5" />, color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30" },
      { label: "Taux complétion", count: 68, total: 100, percent: 68, icon: <Award className="h-5 w-5" />, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30" },
    ],
    chart: [],
    topEnrollements: [],
    players: [],
    totalPlayers: 0,
  };

  return (
    <div className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
        {/* Profil utilisateur (au-dessus des tabs) */}
        <div className="mb-8">
          <ProfileUser />
        </div>

        {/* Tab Menus - Style FeaturesTab */}
        <motion.div
          variants={{
            hidden: { opacity: 0, y: -20 },
            visible: { opacity: 1, y: 0 },
          }}
          initial="hidden"
          whileInView="visible"
          transition={{ duration: 0.5, delay: 0.1 }}
          viewport={{ once: true }}
          className="animate_top mb-15 flex flex-wrap justify-center rounded-[10px] border border-stroke bg-white shadow-solid-5 dark:border-strokedark dark:bg-blacksection dark:shadow-solid-6 md:flex-nowrap md:items-center lg:gap-7.5 xl:mb-21.5 xl:gap-12.5"
        >
          {TABS.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`relative flex w-full cursor-pointer items-center gap-4 border-b border-stroke px-6 py-2 last:border-0 dark:border-strokedark md:w-auto md:border-0 xl:px-13.5 xl:py-5 ${
                currentTab === tab.id
                  ? "active before:absolute before:bottom-0 before:left-0 before:h-1 before:w-full before:rounded-tl-[4px] before:rounded-tr-[4px] before:bg-primary"
                  : ""
              }`}
            >
              <div className="flex h-12.5 w-12.5 items-center justify-center rounded-[50%] border border-stroke dark:border-strokedark dark:bg-blacksection">
                <p className="text-metatitle3 font-medium text-black dark:text-white">
                  {String(TABS.findIndex((t) => t.id === tab.id) + 1).padStart(
                    2,
                    "0"
                  )}
                </p>
              </div>
              <div className="md:w-3/5 lg:w-auto">
                <button className="text-sm font-medium text-black dark:text-white xl:text-regular">
                  {tab.name}
                </button>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Contenu */}
        <section>
          {currentTab === "metriques" && (
            menuKey === "ADMIN" || menuKey === "MOD"
              ? <MetricsAgent role={menuKey as "ADMIN" | "MOD"} />
              : (metriques || <MetriqueLayout data={mockMetricsData} role="PLAYER" />)
          )}
          {currentTab === "agents" && children}
          {currentTab === "enrollements" && (enrollements || <Enrollements />)}
          {currentTab === "questions" && (
            <QuestionsAdmin />
          )}
          {currentTab === "parties" && (
            <div className="text-center italic text-waterloo">
              Module Parties à venir...
            </div>
          )}
          {currentTab === "retraits" && (
            <div className="text-center italic text-waterloo">
              Module Retraits à venir...
            </div>
          )}
          {currentTab === "parcours" && (
            <div className="text-center italic text-waterloo">
              Module Parcours à venir...
            </div>
          )}
          {currentTab === "matchs" && (
            <div className="text-center italic text-waterloo">
              Module Matchs à venir...
            </div>
          )}
        </section>
      </div>
    </div>
  );
}