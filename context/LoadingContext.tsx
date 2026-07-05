"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Common/Logo";

// ─── Context ───────────────────────────────────────────────────────────────

interface LoadingState {
  active: boolean;
  message: string;
}

interface LoadingContextType {
  /** Déclenche le loader global avec un message */
  startLoading: (message?: string) => void;
  /** Arrête le loader global */
  stopLoading: () => void;
  /** Exécute une fonction async avec le loader actif automatiquement */
  withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
  /** État brut (utile pour le composant d'affichage) */
  state: LoadingState;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useLoading(): LoadingContextType {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading doit être utilisé dans <LoadingProvider>");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadingState>({ active: false, message: "Chargement…" });

  const startLoading = useCallback((message = "Chargement…") => {
    setState({ active: true, message });
  }, []);

  const stopLoading = useCallback(() => {
    setState({ active: false, message: "" });
  }, []);

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, message?: string): Promise<T> => {
      startLoading(message);
      try {
        return await fn();
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading],
  );

  return (
    <LoadingContext.Provider value={{ startLoading, stopLoading, withLoading, state }}>
      {children}

      {/* Overlay global */}
      <AnimatePresence>
        {state.active && (
          <motion.div
            key="global-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-6"
            >
              {/* Logo animé */}
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, 6, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" />
                <Logo text="" href="#" className="relative" />
              </motion.div>

              {/* Barre de progression */}
              <div className="w-56 overflow-hidden rounded-full bg-stroke dark:bg-strokedark">
                <motion.div
                  className="h-1.5 rounded-full bg-gradient-to-r from-primary via-purple-500 to-primary"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Message */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium text-waterloo"
              >
                {state.message}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LoadingContext.Provider>
  );
}