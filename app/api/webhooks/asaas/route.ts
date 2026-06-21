import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Asaas eventos que afetam status do tenant
const ACTIVATE_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const SUSPEND_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "SUBSCRIPTION_CANCELLED",
  "PAYMENT_DELETED",
]);

export async function POST(req: NextRequest) {
  // Validar token secreto no header (configurado no painel Asaas)
  const token = req.headers.get("asaas-access-token");
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    event: string;
    payment?: { subscription?: string };
    subscription?: { id?: string };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const { event } = body;

  // Extrair subscription ID do payload
  const subscriptionId =
    body.subscription?.id ?? body.payment?.subscription ?? null;

  if (!subscriptionId) {
    return new Response("OK — no subscription id", { status: 200 });
  }

  const db = createAdminClient();

  if (ACTIVATE_EVENTS.has(event)) {
    await db
      .from("tenants")
      .update({ status: "active" })
      .eq("asaas_subscription_id", subscriptionId);
  } else if (SUSPEND_EVENTS.has(event)) {
    await db
      .from("tenants")
      .update({ status: "suspended" })
      .eq("asaas_subscription_id", subscriptionId);
  }

  return new Response("OK", { status: 200 });
}
