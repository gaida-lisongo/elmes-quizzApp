import { NextRequest, NextResponse } from "next/server";
import { verifyPersistedPaymentAction } from "@/actions/payment.actions";

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

async function handleFlexPayCallback(request: NextRequest) {
  const payload = await readPayload(request);
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  const payloadData = typeof payload === "object" && payload !== null ? payload as Record<string, any> : {};
  const transaction = payloadData.transaction || {};
  const orderNumber =
    searchParams.orderNumber ||
    searchParams.order_number ||
    searchParams.order ||
    payloadData.orderNumber ||
    payloadData.order_number ||
    payloadData.order ||
    transaction.orderNumber ||
    transaction.order_number ||
    "";
  const reference =
    searchParams.reference ||
    payloadData.reference ||
    transaction.reference ||
    "";

  console.log("[FLEXPAY CALLBACK]", {
    method: request.method,
    path: request.nextUrl.pathname,
    searchParams,
    payload,
    userAgent: request.headers.get("user-agent"),
  });

  if (!orderNumber && !reference) {
    return NextResponse.json({ success: false, error: "Paramètres de transaction manquants." }, { status: 400 });
  }

  const result = await verifyPersistedPaymentAction({
    orderNumber,
    reference,
    playerId: searchParams.playerId || payloadData.playerId,
    resourceType: searchParams.resourceType || payloadData.resourceType,
    resourceId: searchParams.resourceId || payloadData.resourceId,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}

export async function GET(request: NextRequest) {
  return handleFlexPayCallback(request);
}

export async function POST(request: NextRequest) {
  return handleFlexPayCallback(request);
}
