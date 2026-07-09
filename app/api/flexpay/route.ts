import { NextRequest, NextResponse } from "next/server";

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

  console.log("[FLEXPAY CALLBACK]", {
    method: request.method,
    path: request.nextUrl.pathname,
    searchParams,
    payload,
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ success: true });
}

export async function GET(request: NextRequest) {
  return handleFlexPayCallback(request);
}

export async function POST(request: NextRequest) {
  return handleFlexPayCallback(request);
}
