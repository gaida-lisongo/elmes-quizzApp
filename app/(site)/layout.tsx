import { Inter } from "next/font/google";
import "../globals.css";
import type { Metadata } from "next";
import Proivder from "./Provider";

import {
  getFooterParcours,
  getFooterCompetitions,
} from "@/actions/footer.actions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Solid | Next.js Template for Startup and SaaS",
  description: "Built with Next.js and TypeScript",
  icons: {
    icon: "/images/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Données pour le footer (fetch serveur)
  const [parcours, competitions] = await Promise.all([
    getFooterParcours(),
    getFooterCompetitions(),
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`dark:bg-black ${inter.className}`}>
        <Proivder footerParcours={parcours} footerCompetitions={competitions}>
          {children}
        </Proivder>
      </body>
    </html>
  );
}
