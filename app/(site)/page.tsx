import { Metadata } from "next";
import Hero from "@/components/Hero";
import Brands from "@/components/Brands";
import Feature from "@/components/Features";
import About from "@/components/About";
import FeaturesTab from "@/components/FeaturesTab";
import FunFact from "@/components/FunFact";
import Integration from "@/components/Integration";
import CTA from "@/components/CTA";
import FAQ from "@/components/FAQ";
import Pricing from "@/components/Pricing";
import Contact from "@/components/Contact";
import Blog from "@/components/Blog";
import Testimonial from "@/components/Testimonial";
import ParcoursSection from "@/components/Parcours";
import CompetitionsSection from "@/components/Competitions";
import PassesSection from "@/components/Passes";
import { getSession } from "@/lib/utils/auth";

export const metadata: Metadata = {
  title: "ELMES-QUIZ | Le savoir devient un pouvoir",

  // other metadata
  description: "Plateforme de quiz et compétition intellectuelle"
};

export default async function Home() {
  const session = await getSession();
  const isAdmin = session?.role === "ADMIN" || session?.role === "MOD";

  return (
    <main>
      <Hero />
      <FunFact />
      <ParcoursSection isAdmin={isAdmin} />
      <PassesSection />
      <CompetitionsSection isAdmin={isAdmin} />
      <Feature />
      {/* <Brands /> */}
      <About />
      <Integration />
      <CTA />
      <FAQ />
      <Testimonial />
      <Contact />
      <Blog />
    </main>
  );
}
