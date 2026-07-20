import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { confirmEmailTemplate } from "@/lib/emails/confirm-email";
import { createAdminClient } from "@/lib/supabase/admin";

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET || "";

// Comparação de tamanho fixo — evita vazar o segredo por timing.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(req: NextRequest, body: string): boolean {
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

  return safeEqual(`v1,${hash}`, signature);
}

const userShape = z
  .object({
    email: z.string().email().optional(),
    user_metadata: z
      .object({ full_name: z.string().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const webhookSchema = z
  .object({
    type: z.string().optional(),
    record: userShape.optional(),
    user: userShape.optional(),
  })
  .passthrough();

// Eventos que disparam o e-mail de confirmação com o branding do tenant.
const CONFIRM_EVENTS = new Set([
  "auth.user_confirmation_email_requested",
  "auth.user_signup",
  "user.confirmation_email",
]);

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Fail-closed: sem assinatura válida a request nem é parseada.
  if (!verifySignature(req, body)) {
    console.error("[webhook] assinatura invalida/ausente");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    console.error("[webhook] JSON invalido no body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("[webhook] payload fora do formato esperado");
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;

  if (!payload.type || !CONFIRM_EVENTS.has(payload.type)) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const email = payload.record?.email ?? payload.user?.email;
  const fullName =
    payload.record?.user_metadata?.full_name ??
    payload.user?.user_metadata?.full_name;

  if (!email) {
    console.error("[webhook] evento de confirmacao sem email");
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data: user } = await db
      .from("users")
      .select("tenant_id")
      .eq("email", email)
      .maybeSingle<{ tenant_id: string | null }>();

    const tenantId = user?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const { data: tenant } = await db
      .from("tenants")
      .select("name, primary_color, slug")
      .eq("id", tenantId)
      .maybeSingle<{
        name: string;
        primary_color: string | null;
        slug: string;
      }>();

    if (!tenant) {
      return NextResponse.json(
        { error: "Tenant config not found" },
        { status: 404 },
      );
    }

    const confirmLink = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/confirm`;

    const { subject, html } = confirmEmailTemplate({
      tenantName: tenant.name,
      primaryColor: tenant.primary_color || "#0ea5e9",
      confirmLink,
      userName: fullName,
    });

    await sendEmail({ to: email, subject, html });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[webhook] falha ao enviar email:", err);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 },
    );
  }
}
