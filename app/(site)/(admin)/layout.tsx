"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const USER_MENU = [
    {
        account: 'MOD',
        menu: [
            { id: 'metriques', name: 'Métriques' },
            { id: 'questions', name: 'Questions' },
            { id: 'enrollements', name: 'Enrollements' },
        ]
    },
    {
        account: 'ADMIN',
        menu: [
            { id: 'metriques', name: 'Métriques' },
            { id: 'agents', name: 'Agents' },
            { id: 'enrollements', name: 'Enrollements' },
        ]
    },
    {
        account: 'STANDALONE',
        menu: [
            { id: 'metriques', name: 'Métriques' },
            { id: 'parties', name: 'Parties' },
            { id: 'retraits', name: 'Retraits' },
        ]
    },
    {
        account: 'ADVANCED',
        menu: [
            { id: 'metriques', name: 'Métriques' },
            { id: 'parcours', name: 'Parcours' },
            { id: 'retraits', name: 'Retraits' },
        ]
    },
    {
        account: 'VIP',
        menu: [
            { id: 'metriques', name: 'Métriques' },
            { id: 'matchs', name: 'Matchs' },
            { id: 'retraits', name: 'Retraits' },
        ]
    },
];

const CURRENT_ROLE = 'ADMIN';

const activeMenu = USER_MENU.find((u) => u.account === CURRENT_ROLE)?.menu || USER_MENU[1].menu;

const TABS = activeMenu;

export default function AdminLayout({
  children,
  agents,
  metriques,
  enrollements,
}: {
  children: React.ReactNode;
  agents?: React.ReactNode;
  metriques?: React.ReactNode;
  enrollements?: React.ReactNode;
}) {
  const [currentTab, setCurrentTab] = useState("metriques");

  return (
    <div className="overflow-hidden pb-20 pt-35 md:pt-40 xl:pb-25 xl:pt-46">
      <div className="mx-auto max-w-c-1390 px-4 md:px-8 2xl:px-0">
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
                  {String(TABS.findIndex((t) => t.id === tab.id) + 1).padStart(2, "0")}
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
            <div className="text-center italic text-waterloo">
              Module Métriques à venir...
            </div>
          )}
          {currentTab === "agents" && children}
          {currentTab === "enrollements" && (
            <div className="text-center italic text-waterloo">
              Module Enrollements à venir...
            </div>
          )}
          {currentTab === "questions" && (
            <div className="text-center italic text-waterloo">
              Module Questions à venir...
            </div>
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