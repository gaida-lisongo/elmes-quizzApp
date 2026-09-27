import 'server-only';
import { trainingPasses } from '@/components/Passes/passesData';

/**
 * Catalogue de prix côté serveur (EX-PAY-01) : seule source des montants.
 * Tout montant reçu du navigateur est ignoré ; le client n'envoie qu'un identifiant de produit,
 * la devise, le canal et le téléphone.
 */

export type ProductType = 'TRAINING_PASS' | 'PARCOURS' | 'COMPETITION' | 'EQUIPE';
export type Currency = 'CDF' | 'USD';

export interface Price {
  amountCDF: number;
  amountUSD: number;
}

/**
 * Taux unique USD → CDF, utilisé seulement pour l'équivalent comptable des paiements en USD (Q-02).
 * Les prix en USD restent une grille fixe par produit.
 * TODO(Q-02): valeur par défaut à confirmer ; définir USD_CDF_RATE dans l'environnement.
 */
export const USD_CDF_RATE = Number(process.env.USD_CDF_RATE) > 0 ? Number(process.env.USD_CDF_RATE) : 2800;

export const TEAM_CREATION_PRICE: Price = { amountCDF: 2500, amountUSD: 1 };
export const DEFAULT_PARCOURS_FEE: Price = { amountCDF: 15000, amountUSD: 5 };
export const DEFAULT_COMPETITION_FEE_USD = 5;

/** Niveau cible historique des packs (statistiques de ventes par pack). */
const PASS_TARGET_LEVEL: Record<string, number> = { elembo: 1, motuya: 2, elonga: 3 };

export interface TrainingPassProduct extends Price {
  id: string;
  name: string;
  parties: number;
  targetLevel: number;
}

export function getTrainingPass(productId: unknown): TrainingPassProduct | null {
  const pass = trainingPasses.find((item) => item.slug === String(productId || '').toLowerCase());
  if (!pass) return null;
  return {
    id: pass.slug,
    name: pass.designation,
    amountCDF: pass.amountCDF,
    amountUSD: pass.amountUSD,
    parties: pass.totalParties,
    targetLevel: PASS_TARGET_LEVEL[pass.slug] ?? 0,
  };
}

/** Équivalent USD entier d'un montant CDF, pour un frais configuré sans grille USD. */
const usdFromCdf = (amountCDF: number) => Math.max(1, Math.ceil(amountCDF / USD_CDF_RATE));

/**
 * Frais d'enrôlement à un Parcours : frais de la session s'il est configuré, sinon 15 000 CDF.
 * (Correction PAY-05 : l'ancienne logique inversée refusait tout enrôlement à frais configuré.)
 */
export function getParcoursEnrollmentPrice(session: { enrollmentFeeCDF?: number | null; enrollmentFeeUSD?: number | null }): Price {
  const configuredCDF = Number(session?.enrollmentFeeCDF || 0);
  if (configuredCDF <= 0) return { ...DEFAULT_PARCOURS_FEE };
  const configuredUSD = Number(session?.enrollmentFeeUSD || 0);
  // TODO(Q-02): renseigner Session.enrollmentFeeUSD pour une grille USD fixe ; sinon conversion au taux unique.
  return { amountCDF: Math.floor(configuredCDF), amountUSD: configuredUSD > 0 ? Math.ceil(configuredUSD) : usdFromCdf(configuredCDF) };
}

/** Frais d'enrôlement d'une équipe à une Compétition : Competition.amount (CDF). */
export function getCompetitionEnrollmentPrice(competition: { amount?: number | null; amountUSD?: number | null }): Price | null {
  const amountCDF = Math.floor(Number(competition?.amount || 0));
  if (amountCDF <= 0) return null;
  const amountUSD = Number(competition?.amountUSD || 0);
  return { amountCDF, amountUSD: amountUSD > 0 ? Math.ceil(amountUSD) : DEFAULT_COMPETITION_FEE_USD };
}

/** Montant à payer dans la devise choisie, et son équivalent CDF comptable. */
export function resolveCharge(price: Price, currency: Currency) {
  if (currency === 'USD') {
    return { amount: price.amountUSD, currency, amountCDF: Math.round(price.amountUSD * USD_CDF_RATE), fxRate: USD_CDF_RATE };
  }
  return { amount: price.amountCDF, currency: 'CDF' as const, amountCDF: price.amountCDF, fxRate: 1 };
}

export const isCurrency = (value: unknown): value is Currency => value === 'CDF' || value === 'USD';
