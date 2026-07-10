import { Inter } from "next/font/google";
import "../globals.css";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/utils/metadata";
import Proivder from "./Provider";

import {
  getFooterParcours,
  getFooterCompetitions,
} from "@/actions/footer.actions";
import { getCurrentUserDetailed } from "@/actions/auth.actions";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = buildMetadata("Accueil");

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session côté serveur (instantanée, pas de flickering)
  const userData = await getCurrentUserDetailed();

  console.log("User data in RootLayout:", userData);

  // Données pour le footer
  const [parcours, competitions] = await Promise.all([
    getFooterParcours(),
    getFooterCompetitions(),
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`dark:bg-black ${inter.className}`}>
        <Proivder
          footerParcours={parcours}
          footerCompetitions={competitions}
          session={userData ? { userId: userData._id, role: userData?.playerType ?? userData?.role } : null}
        >
          {children}
        </Proivder>
      </body>
    </html>
  );
}
