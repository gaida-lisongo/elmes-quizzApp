import 'server-only';
import crypto from 'crypto';

// Empreinte au format scrypt$N$r$p$sel$empreinte (module natif crypto, sans dépendance).
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export const PASSWORD_MIN_LENGTH = 8;

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${key.toString('hex')}`;
}

function safeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && bufA.length > 0 && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie un mot de passe.
 * Migration transparente : une ancienne empreinte SHA-256 est acceptée, et `needsRehash`
 * indique à l'appelant qu'il doit réécrire l'empreinte au format scrypt.
 */
export async function verifyPassword(
  password: string,
  stored: string | undefined | null,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!password || !stored) return { valid: false, needsRehash: false };

  if (stored.startsWith('scrypt$')) {
    const [, n, r, p, saltHex, keyHex] = stored.split('$');
    if (!saltHex || !keyHex) return { valid: false, needsRehash: false };
    const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), Number(n), Number(r), Number(p));
    return { valid: safeEqualHex(key.toString('hex'), keyHex), needsRehash: false };
  }

  // Ancien format : SHA-256 hexadécimal sans sel.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const legacy = crypto.createHash('sha256').update(password).digest('hex');
    const valid = safeEqualHex(legacy, stored.toLowerCase());
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

export function validateNewPassword(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (password.length > 200) return 'Le mot de passe est trop long.';
  return null;
}
