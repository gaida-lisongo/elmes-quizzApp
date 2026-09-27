import 'server-only';
import Redis from 'ioredis';
import { headers } from 'next/headers';

/**
 * Limitation de débit : compteur Redis (INCR + EXPIRE) si REDIS_URL est défini,
 * sinon compteur en mémoire (par instance serveur, moins robuste mais jamais bloquant).
 */

let client: Redis | null = null;
let redisDisabled = !process.env.REDIS_URL;

function getClient(): Redis | null {
  if (redisDisabled) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL as string, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 1000);
      },
    });
    client.on('error', (err) => {
      console.warn('[RateLimit] Redis indisponible, repli en mémoire :', err.message);
    });
  }
  return client;
}

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

async function hit(key: string, windowMs: number): Promise<number> {
  const redis = getClient();
  if (redis) {
    try {
      if (redis.status === 'wait') await redis.connect();
      const count = await redis.incr(key);
      if (count === 1) await redis.pexpire(key, windowMs);
      return count;
    } catch {
      // Repli silencieux : Redis est optionnel.
    }
  }
  return memoryHit(key, windowMs);
}

async function read(key: string): Promise<number> {
  const redis = getClient();
  if (redis) {
    try {
      if (redis.status === 'wait') await redis.connect();
      return Number(await redis.get(key)) || 0;
    } catch {
      // Repli mémoire
    }
  }
  const entry = memory.get(key);
  return entry && entry.resetAt > Date.now() ? entry.count : 0;
}

async function reset(key: string) {
  memory.delete(key);
  const redis = getClient();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
}

/** Adresse IP du client (en-têtes posés par Vercel / le proxy). */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get('x-real-ip') ||
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown'
    );
  } catch {
    return 'unknown';
  }
}

/** Incrémente le compteur et indique si la limite est dépassée. */
export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const count = await hit(`rl:${key}`, windowMs);
  return { allowed: count <= limit, count };
}

/** Vérifie la limite sans incrémenter. */
export async function isRateLimited(key: string, limit: number) {
  return (await read(`rl:${key}`)) >= limit;
}

export async function resetRateLimit(key: string) {
  await reset(`rl:${key}`);
}
