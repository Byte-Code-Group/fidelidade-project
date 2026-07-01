import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/email";
import { confirmEmailTemplate } from "@/lib/emails/confirm-email";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET || "";

async function verifySignature(
  req: NextRequest,
  body: string
): Promise<boolean> {
  const signature = req.headers.get("x-webhook-signature");
  if (!signature || !WEBHOOK_SECRET) return false;

  // Supabase format: v1,whsec_<base64>
  const secret = WEBHOOK_SECRET.split(",")[1]?.replace("whsec_", "") || "";
  if (!secret) return false;

  const secretBytes = Buffer.from(secret, "base64");
  const hash = crypto
    .createHmac("sha256", secretBytes)
    .update(body)
    .digest("base64");

  return `v1,${hash}` === signature;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  console.log("[webhook] Full payload:", body);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error("[webhook] JSON parse error");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookPayload = payload as Record<string, any>;
  console.log("[webhook] Parsed:", JSON.stringify(webhookPayload, null, 2));
  console.log("[webhook] Event type:", webhookPayload.type);

  // Aceitar qualquer evento de confirmação/email
  const isConfirmEmail =
    webhookPayload.type === "auth.user_confirmation_email_requested" ||
    webhookPayload.type === "auth.user_signup" ||
    webhookPayload.type === "user.confirmation_email";

  if (!isConfirmEmail) {
    console.log("[webhook] Skipping event type:", webhookPayload.type);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const email = webhookPayload.record?.email || webhookPayload.user?.email;
  const fullName =
    webhookPayload.record?.user_metadata?.full_name ||
    webhookPayload.user?.user_metadata?.full_name;

  console.log("[webhook] Email:", email, "Name:", fullName);

  if (!email) {
    console.error("[webhook] Missing email");
    return NextResponse.json(
      { error: "Missing email" },
      { status: 400 }
    );
  }

  try {
    // Extrair tenant a partir do domínio ou email
    const db = createAdminClient();
    const { data: user } = await db
      .from("users")
      .select("tenant_id")
      .eq("email", email)
      .single();

    const tenantId = user?.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 404 }
      );
    }

    const { data: tenant } = await db
      .from("tenants")
      .select("name, primary_color, slug")
      .eq("id", tenantId)
      .single();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant config not found" },
        { status: 404 }
      );
    }

    // Gerar magic link (Supabase fornece via payload, mas vamos construir)
    const confirmLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm`;

    const { subject, html } = confirmEmailTemplate({
      tenantName: tenant.name,
      primaryColor: tenant.primary_color || "#0ea5e9",
      confirmLink,
      userName: fullName,
    });

    console.log("[webhook] Sending email to:", email);
    await sendEmail({ to: email, subject, html });
    console.log("[webhook] Email sent successfully");

    return NextResponse.json(
      {
        success: true,
        message: "Email sent via webhook",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[webhook] Error:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
