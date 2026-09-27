/**
 * Adresses publiques de l'application utilisées dans les paiements (callback FlexPay,
 * pages de retour, liens des e-mails).
 *
 * En preview Vercel, HOST et APP_URL pointent vers la production (variables partagées) :
 * les retours d'un paiement lancé depuis une preview partaient donc vers la production, qui ne
 * connaît pas la transaction. En preview, on utilise l'URL de la branche fournie par Vercel.
 */

function previewBaseUrl(): string | null {
  if (process.env.VERCEL_ENV !== 'preview') return null;
  const host = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}

/** Base des appels serveur à serveur (callback du fournisseur de paiement). */
export function serverBaseUrl(): string {
  return (previewBaseUrl() || process.env.HOST || 'http://localhost:3000').replace(/\/$/, '');
}

/** Base des pages ouvertes par le joueur (retour de paiement, liens d'e-mail). */
export function publicAppUrl(): string {
  return (
    previewBaseUrl() ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.HOST ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

/**
 * URL du callback de paiement.
 * TODO: en preview, la protection Vercel bloque les appels du fournisseur ; la transaction est alors
 * validée par la page de retour ou le bouton « vérifier » (même flux verifyAndApplyPayment).
 */
export function paymentCallbackUrl(): string {
  return `${serverBaseUrl()}/api/flexpay`;
}
