"use client";
import React, { useState } from "react";
import Image from "next/image";
import SectionHeader from "@/components/Common/SectionHeader";
import { motion } from "framer-motion";
import SinglePass from "./SinglePass";
import { trainingPasses } from "./passesData";
import PaymentDrawer from "@/components/PaymentDrawer";

const PassesSection = () => {
  const [selectedPass, setSelectedPass] = useState<typeof trainingPasses[0] | null>(null);

  return (
    <>
      <section className="overflow-hidden pb-20 pt-15 lg:pb-25 xl:pb-30">
        <div className="mx-auto max-w-c-1315 px-4 md:px-8 xl:px-0">
          <div className="animate_top mx-auto text-center">
            <SectionHeader
              headerInfo={{
                title: "PASS D'ENTRAÎNEMENT",
                subtitle: "Boost ton entraînement",
                description: `Choisis le pass qui correspond à ton ambition. Plus tu t'entraînes, plus tu progresses vers la Prime du Mérite Mensuel.`,
              }}
            />
          </div>
        </div>

        <div className="relative mx-auto mt-15 max-w-[1207px] px-4 md:px-8 xl:mt-20 xl:px-0">
          <div className="absolute -bottom-15 -z-1 h-full w-full">
            <Image
              fill
              src="./images/shape/shape-dotted-light.svg"
              alt="Dotted"
              className="dark:hidden"
            />
          </div>
          <div className="flex flex-wrap justify-center gap-7.5 lg:flex-nowrap xl:gap-12.5">
            {trainingPasses.map((pass, index) => (
              <SinglePass
                key={pass.slug}
                pass={pass}
                index={index}
                onBuy={() => setSelectedPass(pass)}
              />
            ))}
          </div>
        </div>
      </section>

      {selectedPass && (
        <PaymentDrawer
          product={{
            id: selectedPass.slug,
            name: selectedPass.designation,
            amountCDF: selectedPass.amountCDF,
            amountUSD: selectedPass.amountUSD,
            type: "TRAINING_PASS",
            metadata: {
              parties: selectedPass.parties,
              bonus: selectedPass.bonus,
              totalParties: selectedPass.totalParties,
            },
          }}
          onClose={() => setSelectedPass(null)}
          onSuccess={() => {
            setSelectedPass(null);
          }}
        />
      )}
    </>
  );
};

export default PassesSection;