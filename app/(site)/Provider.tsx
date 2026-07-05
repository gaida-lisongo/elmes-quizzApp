"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Lines from "@/components/Lines";
import ScrollToTop from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import ToasterContext from "../context/ToastContext";
import { LoadingProvider } from "@/context/LoadingContext";
import { SessionProvider } from "@/context/SessionContext";
import type { FooterParcours, FooterCompetition } from "@/actions/footer.actions";

interface ServerSession {
  userId: string;
  role: string;
}

export default function ClientLayout({
  children,
  footerParcours,
  footerCompetitions,
  session,
}: {
  children: React.ReactNode;
  footerParcours: FooterParcours[];
  footerCompetitions: FooterCompetition[];
  session: ServerSession | null;
}) {
  return (
    <ThemeProvider
      enableSystem={false}
      attribute="class"
      defaultTheme="light"
    >
      <SessionProvider serverSession={session}>
        <LoadingProvider>
          <Lines />
          <Header session={session} />
          <ToasterContext />
          {children}
          <Footer
            parcours={footerParcours}
            competitions={footerCompetitions}
          />
          <ScrollToTop />
        </LoadingProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
