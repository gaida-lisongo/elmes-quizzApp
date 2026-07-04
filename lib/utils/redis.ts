import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ═══════════════════════════════════════════════════════════════
// Singleton Redis (publisher)
// ═══════════════════════════════════════════════════════════════

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // abandon
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    publisher.on("error", (err) => {
      console.warn("[Redis Publisher] Erreur (non bloquante):", err.message);
    });
  }
  return publisher;
}

// ═══════════════════════════════════════════════════════════════
// Canaux
// ═══════════════════════════════════════════════════════════════

export const PROGRESS_CHANNEL = "progress:update";

// ═══════════════════════════════════════════════════════════════
// Publier un événement de mise à jour de progression
// ═══════════════════════════════════════════════════════════════

export async function publishProgressUpdate(payload: {
  type: "score_update" | "equipe_created" | "level_up";
  userId?: string;
  totalScore?: number;
  newLevel?: number;
  equipesCount?: number;
}) {
  try {
    const pub = getPublisher();
    await pub.publish(PROGRESS_CHANNEL, JSON.stringify(payload));
  } catch (err) {
    // Silencieux — Redis est optionnel, le polling prend le relais
    console.warn("[Redis] Impossible de publier l'événement:", err);
  }
}

// ═══════════════════════════════════════════════════════════════
// S'abonner aux événements (utilisé par l'API SSE si besoin)
// ═══════════════════════════════════════════════════════════════

export function createSubscriber(): Redis {
  const sub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
  });
  sub.on("error", (err) => {
    console.warn("[Redis Subscriber] Erreur:", err.message);
  });
  return sub;
}