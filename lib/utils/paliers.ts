/**
 * Paliers joueurs ELMES-QUIZ : trois paliers CUMULATIFS.
 *
 * Tout ce que le palier 1 peut faire, le palier 2 le peut aussi ; tout ce que le palier 2
 * peut faire, le palier 3 le peut aussi. Un joueur ne redescend jamais de palier.
 *
 * Montée automatique (voir lib/services/palier.service.ts) :
 *  - palier 2 : à la confirmation de son premier enrôlement à un Parcours ;
 *  - palier 3 : à la création de son équipe, quand il accepte une invitation d'équipe
 *    ou quand un gestionnaire le nomme capitaine.
 *
 * Les noms affichés se changent ICI uniquement (aucune migration nécessaire) :
 * la base ne stocke que la clé PALIER_1 / PALIER_2 / PALIER_3.
 *
 * Fichier sans dépendance serveur : utilisable côté client et côté serveur.
 */

export const PALIERS = ['PALIER_1', 'PALIER_2', 'PALIER_3'] as const;
export type PalierJoueur = (typeof PALIERS)[number];
export type RangPalier = 1 | 2 | 3;

/** Anciennes valeurs stockées en base avant la migration 2026-11-paliers. */
export const ANCIENS_TYPES = ['STANDALONE', 'ADVANCED', 'VIP'] as const;
export type AncienType = (typeof ANCIENS_TYPES)[number];

const ANCIEN_VERS_PALIER: Record<AncienType, PalierJoueur> = {
  STANDALONE: 'PALIER_1',
  ADVANCED: 'PALIER_2',
  VIP: 'PALIER_3',
};

export interface InfoPalier {
  palier: PalierJoueur;
  rang: RangPalier;
  nom: string;
  /** Mot utilisé dans les liens d'inscription : /auth/signup#challenger */
  slug: string;
  /** Forme plurielle, ex. « Pour les Curieux ». */
  pluriel: string;
  accroche: string;
  droits: string[];
}

export const INFOS_PALIERS: Record<PalierJoueur, InfoPalier> = {
  PALIER_1: {
    palier: 'PALIER_1',
    rang: 1,
    nom: 'Curieux',
    slug: 'curieux',
    pluriel: 'Curieux',
    accroche: 'Je me teste et je progresse',
    droits: ['Parties d’entraînement', 'Pass d’entraînement', 'Parrainage', 'Retraits'],
  },
  PALIER_2: {
    palier: 'PALIER_2',
    rang: 2,
    nom: 'Challenger',
    slug: 'challenger',
    pluriel: 'Challengers',
    accroche: 'Je vise le podium des Parcours',
    droits: ['Tout le palier Curieux', 'Parcours et classements', 'Prix du top 3'],
  },
  PALIER_3: {
    palier: 'PALIER_3',
    rang: 3,
    nom: 'Champion',
    slug: 'champion',
    pluriel: 'Champions',
    accroche: 'Je défends mon équipe en compétition',
    droits: ['Tout le palier Challenger', 'Équipe de 5', 'Compétitions et matchs', 'Bourse d’Excellence'],
  },
};

const PAR_RANG: Record<RangPalier, PalierJoueur> = { 1: 'PALIER_1', 2: 'PALIER_2', 3: 'PALIER_3' };

/** Convertit n'importe quelle valeur (nouvelle, ancienne, vide) en palier valide. Défaut : PALIER_1. */
export function normaliserPalier(valeur: unknown): PalierJoueur {
  const v = String(valeur ?? '').trim().toUpperCase();
  if ((PALIERS as readonly string[]).includes(v)) return v as PalierJoueur;
  if ((ANCIENS_TYPES as readonly string[]).includes(v)) return ANCIEN_VERS_PALIER[v as AncienType];
  return 'PALIER_1';
}

export function rangDe(valeur: unknown): RangPalier {
  return INFOS_PALIERS[normaliserPalier(valeur)].rang;
}

/** Vrai si le joueur a au moins le rang demandé (règle cumulative). */
export function aAuMoins(valeur: unknown, rang: RangPalier): boolean {
  return rangDe(valeur) >= rang;
}

export function palierDeRang(rang: RangPalier): PalierJoueur {
  return PAR_RANG[rang];
}

export function infoPalier(valeur: unknown): InfoPalier {
  return INFOS_PALIERS[normaliserPalier(valeur)];
}

/** Libellé affichable, ex. « Champion » ; renvoie la valeur telle quelle pour ADMIN / MOD. */
export function libellePalier(valeur: unknown): string {
  const v = String(valeur ?? '').trim().toUpperCase();
  if (v === 'ADMIN' || v === 'MOD' || v === '') return String(valeur ?? '');
  return infoPalier(v).nom;
}

/** Valeurs stockées (nouvelles + anciennes) correspondant exactement à ce rang, pour les requêtes Mongo. */
export function valeursDuRang(rang: RangPalier): Array<PalierJoueur | AncienType> {
  const anciens = (Object.keys(ANCIEN_VERS_PALIER) as AncienType[]).filter(
    (a) => ANCIEN_VERS_PALIER[a] === PAR_RANG[rang],
  );
  return [PAR_RANG[rang], ...anciens];
}

/** Valeurs stockées strictement inférieures à ce rang (joueurs à faire monter). */
export function valeursSousLeRang(rang: RangPalier): Array<PalierJoueur | AncienType> {
  const out: Array<PalierJoueur | AncienType> = [];
  for (let r = 1; r < rang; r++) out.push(...valeursDuRang(r as RangPalier));
  return out;
}

/** Lit le palier depuis un lien d'inscription : #curieux, #challenger, #champion (et anciens #standalone, #advanced, #vip). */
export function palierDepuisSlug(slug: string | null | undefined): PalierJoueur {
  const s = String(slug ?? '').trim().toLowerCase();
  const trouve = PALIERS.find((p) => INFOS_PALIERS[p].slug === s);
  if (trouve) return trouve;
  if (s === 'niveau1' || s === 'palier1') return 'PALIER_1';
  if (s === 'niveau2' || s === 'palier2') return 'PALIER_2';
  if (s === 'niveau3' || s === 'palier3') return 'PALIER_3';
  return normaliserPalier(s);
}

/**
 * Tableau de bord d'arrivée selon le palier.
 * TODO : renommer les dossiers /dashboard/standalone|advanced|vip quand le frontend sera revu.
 */
export function routeTableauDeBord(valeur: unknown): string {
  return { 1: '/dashboard/standalone', 2: '/dashboard/advanced', 3: '/dashboard/vip' }[rangDe(valeur)];
}
