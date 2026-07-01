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

  if (!(await verifySignature(req, body))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const webhookPayload = payload as {
    type?: string;
    record?: { email?: string; user_metadata?: { full_name?: string } };
    user?: { email?: string; user_metadata?: { full_name?: string } };
  };

  // Apenas processar confirmEmail
  if (webhookPayload.type !== "auth.user_confirmation_email_requested") {
    return NextResponse.json({ ok: true });
  }

  const email = webhookPayload.record?.email || webhookPayload.user?.email;
  const fullName =
    webhookPayload.record?.user_metadata?.full_name ||
    webhookPayload.user?.user_metadata?.full_name;

  if (!email) {
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

    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/email]", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
