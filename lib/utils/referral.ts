import crypto from "crypto";

/**
 * Génère un code de parrainage au format lisible :
 * {2 premières lettres du pseudo en majuscule}-{4 caractères hex}
 *
 * Exemple : pour le pseudo "John", le code sera "JO-A3F2"
 */
export function generateReferralCode(pseudo: string): string {
  const prefix = (pseudo || "XX").slice(0, 2).toUpperCase().padEnd(2, "X");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase(); // 4 hex chars
  return `${prefix}-${suffix}`;
}