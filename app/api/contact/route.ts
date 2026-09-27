export const dynamic = "force-dynamic";

import { mailService } from "@/lib/utils/mail";
import { consumeRateLimit } from "@/lib/utils/rateLimit";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Limitation de débit : 5 envois par heure et par adresse IP (EX-SEC-06).
    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const rate = await consumeRateLimit(`contact:${ip}`, 5, 60 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many messages. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    // Champ piège : invisible pour un humain, rempli par les robots.
    if (typeof body.website === "string" && body.website.trim()) {
      return NextResponse.json({ success: true });
    }

    const field = (value: unknown, max: number) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";
    const name = field(body.name, 100);
    const email = field(body.email, 200);
    const subject = field(body.subject, 200);
    const phone = field(body.phone, 30);
    const message = field(body.message, 5000);

    // Validation
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email and message are required." },
        { status: 400 }
      );
    }

    if (!email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 }
      );
    }

    // Build a nice email HTML
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:30px 10px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e3a5f,#2d6a9f);border-radius:16px 16px 0 0;padding:32px 28px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">📬 Nouveau Message</h1>
                    <p style="margin:6px 0 0;color:#b8d4f0;font-size:14px;">Vous avez re&ccedil;u un message depuis votre site web</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="background:#ffffff;padding:32px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
                    
                    <!-- Info envoyeur -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Exp&eacute;diteur</span>
                          <p style="margin:4px 0 0;font-size:18px;font-weight:600;color:#1f2937;">${escapeHtml(name)}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Email</span>
                          <p style="margin:4px 0 0;font-size:15px;color:#2563eb;">
                            <a href="mailto:${escapeHtml(email)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(email)}</a>
                          </p>
                        </td>
                      </tr>
                      ${
                        phone
                          ? `
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">T&eacute;l&eacute;phone</span>
                          <p style="margin:4px 0 0;font-size:15px;color:#1f2937;">${escapeHtml(phone)}</p>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                      ${
                        subject
                          ? `
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Sujet</span>
                          <p style="margin:4px 0 0;font-size:15px;font-weight:500;color:#1f2937;">${escapeHtml(subject)}</p>
                        </td>
                      </tr>
                      `
                          : ""
                      }
                      <tr>
                        <td style="padding:8px 0;">
                          <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Date</span>
                          <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${new Intl.DateTimeFormat("fr-FR", {
                            dateStyle: "full",
                            timeStyle: "short",
                            timeZone: "Africa/Kinshasa",
                          }).format(new Date())}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Separator -->
                    <div style="height:1px;background:#e5e7eb;margin:0 0 24px;"></div>

                    <!-- Message -->
                    <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Message</span>
                    <div style="margin:10px 0 0;padding:20px;background:#f9fafb;border-radius:10px;border-left:4px solid #2d6a9f;font-size:15px;line-height:1.7;color:#374151;white-space:pre-wrap;">
                      ${escapeHtml(message)}
                    </div>

                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:#1e3a5f;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
                    <p style="margin:0;color:#9bb8d6;font-size:13px;">
                      Cet email a &eacute;t&eacute; envoy&eacute; depuis le formulaire de contact de votre site.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email to the site owner
    await mailService.send({
      to: process.env.MAIL_FROM || process.env.MAIL_USER || "",
      subject: subject
        ? `[Contact Site] ${subject} - ${name}`
        : `[Contact Site] Nouveau message de ${name}`,
      html,
      replyTo: email,
    });

    return NextResponse.json({
      success: true,
      message: "Message sent successfully! We'll get back to you soon.",
    });
  } catch (error: any) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      {
        error: "Failed to send message. Please try again later.",
      },
      { status: 500 }
    );
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}