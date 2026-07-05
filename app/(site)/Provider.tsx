"use client";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Lines from "@/components/Lines";
import ScrollToTop from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import ToasterContext from "../context/ToastContext";
import { LoadingProvider } from "@/context/LoadingContext";
import type { FooterParcours, FooterCompetition } from "@/actions/footer.actions";

export default function ClientLayout({
  children,
  footerParcours,
  footerCompetitions,
}: {
  children: React.ReactNode;
  footerParcours: FooterParcours[];
  footerCompetitions: FooterCompetition[];
}) {
  return (
    <ThemeProvider
      enableSystem={false}
      attribute="class"
      defaultTheme="light"
    >
      <LoadingProvider>
        <Lines />
        <Header />
        <ToasterContext />
        {children}
        <Footer
          parcours={footerParcours}
          competitions={footerCompetitions}
        />
        <ScrollToTop />
      </LoadingProvider>
    </ThemeProvider>
  );
}
