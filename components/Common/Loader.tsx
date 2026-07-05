"use client";

import { motion } from "framer-motion";
import Logo from "@/components/Common/Logo";

interface LoaderProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "min-h-[200px]",
  md: "min-h-[400px]",
  lg: "min-h-[600px]",
};

const Loader = ({ message = "Chargement...", size = "md" }: LoaderProps) => {
  return (
    <div
      className={`flex ${sizeClasses[size]} w-full items-center justify-center`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6"
      >
        {/* Logo animé */}
        <motion.div
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative"
        >
          <div className="absolute -inset-4 rounded-full bg-primary/10 blur-xl" />
          <Logo text="" href="#" className="relative" />
        </motion.div>

        {/* Barre de progression */}
        <div className="w-48 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
          <motion.div
            className="h-1.5 rounded-full bg-gradient-to-r from-primary to-purple-500"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-waterloo"
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Loader;