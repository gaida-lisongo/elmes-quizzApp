"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface ServerSession {
  userId: string;
  role: string;
}

interface SessionContextType {
  /** Session injectée par le serveur (instantanée) */
  serverSession: ServerSession | null;
  /** Session rafraîchie côté client (après connexion/déconnexion) */
  activeSession: ServerSession | null;
  /** Type joueur (STANDALONE, ADVANCED, VIP) ou rôle (ADMIN, MOD) — lu depuis le cookie player_type */
  playerType: string | null;
  /** URL du dashboard calculée */
  dashboardUrl: string;
  /** Re-synchroniser la session depuis les cookies */
  refreshSession: () => void;
  /** true si une session est active */
  isAuthenticated: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession doit être utilisé dans <SessionProvider>");
  return ctx;
}

function computeDashboardUrl(playerType: string | null, hasSession: boolean): string {
  if (!hasSession) return "/auth/signin";
  return "/dashboard";
}

function readPlayerTypeFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)player_type=([^;]*)/);
  return match ? match[1] : null;
}

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("genie_session=");
}

export function SessionProvider({
  children,
  serverSession,
}: {
  children: ReactNode;
  serverSession: ServerSession | null;
}) {
  // Initialisation : serveur d'abord, puis cookies si présents
  const [activeSession, setActiveSession] = useState<ServerSession | null>(serverSession);
  const [playerType, setPlayerType] = useState<string | null>(
    serverSession ? readPlayerTypeFromCookie() : null
  );
  const [isAuthenticated, setIsAuthenticated] = useState(!!serverSession);
  const [dashboardUrl, setDashboardUrl] = useState(() =>
    computeDashboardUrl(
      serverSession ? readPlayerTypeFromCookie() : null,
      !!serverSession
    )
  );

  const refreshSession = useCallback(() => {
    const hasSession = hasSessionCookie();
    const pType = readPlayerTypeFromCookie();
    setPlayerType(pType);
    setIsAuthenticated(hasSession);
    setDashboardUrl(computeDashboardUrl(pType, hasSession));

    if (!hasSession) {
      setActiveSession(null);
    }
    // Note: on ne peut pas décoder le userId côté client (cookie httpOnly),
    // donc on garde le serverSession si existant, sinon null
    if (!hasSession) {
      setActiveSession(null);
    }
  }, []);

  // Surveiller les changements de cookies (connexion/déconnexion)
  useEffect(() => {
    // Rafraîchir quand la page redevient visible (après redirect)
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSession();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Polling toutes les 2s pour détecter les changements de cookie
    // (utile après redirection depuis login/signup)
    let lastCheck = hasSessionCookie();
    const interval = setInterval(() => {
      const current = hasSessionCookie();
      if (current !== lastCheck) {
        lastCheck = current;
        refreshSession();
      }
    }, 2000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, [refreshSession]);

  return (
    <SessionContext.Provider
      value={{
        serverSession,
        activeSession,
        playerType,
        dashboardUrl,
        refreshSession,
        isAuthenticated,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}