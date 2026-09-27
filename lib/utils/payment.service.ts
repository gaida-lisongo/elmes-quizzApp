/**
 * Service de paiement — encapsule les appels HTTP vers l'Edge Function Supabase
 * qui sert d'intermédiaire avec FlexPay (Mobile Money, RDC).
 *
 * Variables d'environnement requises :
 *   PAYMENT_API_URL   – URL de base de l'Edge Function
 */

import FlexPay from "./FlexPay";

const BASE_URL = process.env.PAYMENT_API_URL;

// ── Types ──────────────────────────────────────────────────────────

export type PaymentCurrency = 'CDF' | 'USD';

export interface CollectionPayload {
  phone: string;
  amount: number;
  reference: string;
  currency?: PaymentCurrency;
  verificationParams?: Record<string, string | number | undefined>;
}

export interface PayoutPayload {
  phone: string;
  amount: number;
  reference: string;
  currency?: PaymentCurrency;
}

export interface PaymentResponse {
  success: boolean;
  orderNumber?: string;
  redirectUrl?: string;
  message?: string;
  error?: string;
  raw?: any;
}

export interface StatusResponse {
  success: boolean;
  status?: 'EN_ATTENTE' | 'SUCCES' | 'ECHEC';
  orderNumber?: string;
  message?: string;
  error?: string;
  raw?: any;
}

// ── Appels HTTP internes ───────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: T; status: number }> {
  if (!BASE_URL) {
    throw new Error(
      'PAYMENT_API_URL n’est pas défini dans les variables d’environnement.',
    );
  }

  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error: any) {
    // « fetch failed » masque la cause réelle (DNS, connexion refusée, certificat, délai).
    const cause = error?.cause;
    let host = '?';
    try { host = new URL(url).host; } catch { /* URL invalide */ }
    console.error('[payment] passerelle injoignable', JSON.stringify({
      method,
      host,
      path: path.split('?')[0],
      error: error?.name === 'TimeoutError' ? 'timeout 20s' : error?.message,
      cause: cause?.code || cause?.message,
    }));
    throw new Error('Le service de paiement est momentanément injoignable. Réessayez dans quelques minutes.');
  }

  // Réponse non JSON ou sans champ `data` : on renvoie un objet vide plutôt que de planter
  // sur `data.code` avec un message incompréhensible pour le joueur.
  const text = await res.text();
  let data: any = {};
  try {
    const json = JSON.parse(text);
    data = json?.data ?? json ?? {};
  } catch {
    data = {};
  }
  if (!res.ok || !text) {
    console.warn('[payment] passerelle', JSON.stringify({ method, path: path.split('?')[0], http: res.status, body: text.slice(0, 300).replace(/\+?\d{9,15}/g, '***') }));
  }
  return { ok: res.ok, data: data as T, status: res.status };
}

// ── Méthodes publiques ─────────────────────────────────────────────

/**
 * 1. Initie une COLLECTE (paiement depuis un joueur vers le compte marchand).
 *    Utilisé pour les recharges de niveau.
 */
export async function initialCard(payload: CollectionPayload): Promise<PaymentResponse>{
  try {
    const flexCard = new FlexPay();
    const card = await flexCard.initCard(
      payload.phone,
      payload.reference,
      payload.currency || 'USD',
      payload.amount,
      payload.verificationParams,
    );

    if (card.success && card.orderNumber && card.url) {
      return {
        success: true,
        orderNumber: card.orderNumber,
        redirectUrl: card.url,
        message: card.message || 'Paiement carte initie avec succes.',
        raw: card.raw,
      };
    }

    return {
      success: false,
      error: card.error || card.message || "Echec de l'initiation du paiement carte.",
      raw: card.raw,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erreur reseau lors du paiement carte.',
    };
  }
}

export async function initiateCollection(
  payload: CollectionPayload,
): Promise<PaymentResponse> {
  try {

    const { data, status } = await request<any>('POST', '/collect', {
      channel: 'MOBILE_MONEY',
      amount: payload.amount,
      currency: payload.currency ?? 'CDF',
      reference: payload.reference,
      phone: payload.phone,
    });

    // La réponse FlexPay retourne généralement data.code === "0" pour un succès
    if (data.code == '0' && data?.orderNumber) {
      return {
        success: true,
        orderNumber: data.orderNumber,
        message: data.message || 'Collecte initiée avec succès.',
        raw: data,
      };
    }

    return {
      success: false,
      error: data.message || data.error || `Échec de l’initiation de la collecte (HTTP ${status}).`,
      raw: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erreur réseau lors de la collecte.',
    };
  }
}

/**
 * 2. Initie un PAIEMENT (transfert depuis le compte marchand vers un agent).
 *    Utilisé pour les retraits de commissions des agents.
 */
export async function initiatePayout(
  payload: PayoutPayload,
): Promise<PaymentResponse> {
  try {
    const { data, ok } = await request<any>('POST', '/payout', {
      amount: payload.amount,
      currency: payload?.currency ?? 'CDF',
      phone: payload.phone,
      reference: payload.reference,
    });

    if (data.code === '0' && data?.orderNumber) {
      return {
        success: true,
        orderNumber: data.orderNumber,
        message: data.message || 'Paiement initié avec succès.',
        raw: data,
      };
    }

    const message = data?.status == '0XX6' ? "Veuillez patienter le temps que nous disposons des fonds" : data.message || data.error || 'Échec de l’initiation du paiement.'

    return {
      success: false,
      error: message,
      raw: data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erreur réseau lors du paiement.',
    };
  }
}

/**
 * 3. Vérifie le statut d’une transaction à partir de son orderNumber.
 */
export async function checkStatus(
  orderNumber: string,
): Promise<StatusResponse> {
  try {
    const { data } = await request<any>(
      'GET',
      `/check?orderNumber=${encodeURIComponent(orderNumber)}`,
    );

    const transaction = data?.transaction || data || {};

    // Adapter selon la forme de la réponse de l'Edge Function
    const statusMap: Record<string, 'EN_ATTENTE' | 'SUCCES' | 'ECHEC'> = {
      pending: 'EN_ATTENTE',
      success: 'SUCCES',
      failed: 'ECHEC',
      cancelled: 'ECHEC',
    };
    // Codes FlexPay : 0 = succès, 1 = échec, 2 = en attente.
    const codeMap: Record<string, 'EN_ATTENTE' | 'SUCCES' | 'ECHEC'> = {
      '0': 'SUCCES',
      '1': 'ECHEC',
      '2': 'EN_ATTENTE',
    };

    // Un statut inconnu reste EN_ATTENTE, jamais ECHEC définitif (PAY-12).
    const mappedStatus =
      statusMap[String(data?.status || '').toLowerCase()] ||
      codeMap[String(transaction.status)] ||
      'EN_ATTENTE';

    return {
      success: true,
      status: mappedStatus,
      orderNumber,
      message: data.message || 'Statut récupéré.',
      raw: {...transaction, code: transaction?.status},
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erreur réseau lors de la vérification du statut.',
    };
  }
}
