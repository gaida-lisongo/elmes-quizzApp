import { NextRequest, NextResponse } from "next/server";
import { verifyAndApplyPayment } from "@/lib/services/payment-flow.service";

async function readPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json().catch(() => null);
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData().catch(() => null);
    if (!formData) return null;
    return Object.fromEntries(formData.entries());
  }

  const text = await request.text().catch(() => "");
  return text || null;
}

/**
 * Callback FlexPay. Seuls le numéro de commande et la référence sont lus : le produit et l'effet
 * du paiement sont relus en base, et le statut est redemandé au fournisseur (EX-PAY-02, PAY-06).
 * Le traitement est idempotent : un callback rejoué ne crédite rien deux fois.
 */
export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const searchParams = request.nextUrl.searchParams;
  const payloadData = typeof payload === "object" && payload !== null ? payload as Record<string, any> : {};
  const transaction = payloadData.transaction || {};
  const pick = (...values: unknown[]) => values.find((value) => typeof value === "string" && value.trim()) as string | undefined;

  const orderNumber = pick(
    searchParams.get("orderNumber"),
    searchParams.get("order_number"),
    payloadData.orderNumber,
    payloadData.order_number,
    transaction.orderNumber,
    transaction.order_number,
  );
  const reference = pick(searchParams.get("reference"), payloadData.reference, transaction.reference);

  // Journal minimal : aucune donnée personnelle ni payload brut du fournisseur.
  console.log("[FLEXPAY CALLBACK]", { orderNumber: orderNumber || null, reference: reference || null });

  if (!orderNumber && !reference) {
    return NextResponse.json({ success: false, error: "Paramètres de transaction manquants." }, { status: 400 });
  }

  const result = await verifyAndApplyPayment((orderNumber || reference) as string);
  return NextResponse.json(
    { success: result.success, status: result.status, message: result.message || result.error },
    { status: result.success ? 200 : 400 },
  );
}

/** Plus aucune modification sur un simple GET (PAY-22). */
export async function GET() {
  return NextResponse.json({ success: false, error: "Méthode non autorisée." }, { status: 405, headers: { Allow: "POST" } });
}
