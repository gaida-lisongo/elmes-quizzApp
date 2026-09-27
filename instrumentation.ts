/**
 * Contrôle de configuration au démarrage du serveur (EX-SEC-05) :
 * sans JWT_SECRET, l'application refuse de démarrer au lieu d'utiliser un secret par défaut.
 */
export function register() {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('[ELMES-QUIZ] JWT_SECRET est absent : démarrage refusé. Définissez-le dans les variables d’environnement.');
  }
  if (secret.length < 32) {
    console.warn('[ELMES-QUIZ] JWT_SECRET est court (< 32 caractères) : utilisez un secret long et aléatoire.');
  }
}
