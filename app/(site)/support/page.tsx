import React from "react";
import Contact from "@/components/Contact";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact - ELMES Solution",

  // other metadata
  description: "Contactez ELMES Solution pour toute question, demande d'information ou assistance. Nous sommes à votre écoute."
};

const SupportPage = () => {
  return (
    <div className="pb-20 pt-40">
      <Contact />
    </div>
  );
};

export default SupportPage;
