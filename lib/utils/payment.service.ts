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

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const {data} = await res.json();
  return { ok: res.ok, data, status: res.status };
}

// ── Méthodes publiques ─────────────────────────────────────────────

/**
 * 1. Initie une COLLECTE (paiement depuis un joueur vers le compte marchand).
 *    Utilisé pour les recharges de niveau.
 */
export async function initialCard(payload: CollectionPayload): Promise<PaymentResponse>{
  try {
    console.log("Payload for initiateCollection:", payload);
    const flexCard = new FlexPay();
    const card = await flexCard.initCard(
      payload.phone,
      payload.reference,
      payload.currency || 'USD',
      payload.amount,
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

    console.log("Payload for initiateCollection:", payload);
    
    const { data, status } = await request<any>('POST', '/collect', {
      channel: 'MOBILE_MONEY',
      amount: payload.amount,
      currency: payload.currency ?? 'CDF',
      reference: payload.reference,
      phone: payload.phone,
    });
    console.log("[FLEX RESPONSE]", data.code == '0')

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
      success: status == 0,
      error: data.message || data.error || 'Échec de l’initiation de la collecte.',
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

    console.log('PayOut', data)

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

    console.log("[Payment Service Check]", data)

    const { transaction } = data

    // Adapter selon la forme de la réponse de l'Edge Function
    const statusMap: Record<string, 'EN_ATTENTE' | 'SUCCES' | 'ECHEC'> = {
      pending: 'EN_ATTENTE',
      success: 'SUCCES',
      failed: 'ECHEC',
      cancelled: 'ECHEC',
    };

    const mappedStatus =
      statusMap[data.status?.toLowerCase()] ||
      (transaction.status === '2' ? 'EN_ATTENTE' : (transaction.status === '0' ? 'SUCCES' : 'ECHEC'));

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
