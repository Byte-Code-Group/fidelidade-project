import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyScheduledChanges } from "@/lib/tenant-billing";

// Asaas eventos que afetam status do tenant
const ACTIVATE_EVENTS = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const SUSPEND_EVENTS = new Set([
  "PAYMENT_OVERDUE",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
  "PAYMENT_DELETED",
]);

export async function POST(req: NextRequest) {
  // Validar token secreto no header (configurado no painel Asaas)
  const token = req.headers.get("asaas-access-token");
  if (token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    console.error("[asaas webhook] token invalido/ausente");
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
    console.error("[asaas webhook] JSON invalido no body");
    return new Response("Bad JSON", { status: 400 });
  }

  const { event } = body;

  // Extrair subscription ID do payload
  const subscriptionId =
    body.subscription?.id ?? body.payment?.subscription ?? null;

  console.log(`[asaas webhook] event=${event} subscriptionId=${subscriptionId}`);

  if (!subscriptionId) {
    return new Response("OK — no subscription id", { status: 200 });
  }

  const db = createAdminClient();

  if (ACTIVATE_EVENTS.has(event)) {
    const { error, data } = await db
      .from("tenants")
      .update({ status: "active" })
      .eq("asaas_subscription_id", subscriptionId)
      .select("id");
    console.log(`[asaas webhook] ativando tenant, matched=${data?.length ?? 0} error=${error?.message ?? "none"}`);

    // Pagamento confirmado = novo ciclo começou — se tinha um downgrade
    // agendado pro fim do ciclo anterior, aplica agora.
    for (const row of data ?? []) {
      await applyScheduledChanges(row.id);
    }
  } else if (SUSPEND_EVENTS.has(event)) {
    const { error, data } = await db
      .from("tenants")
      .update({ status: "suspended" })
      .eq("asaas_subscription_id", subscriptionId)
      .select("id");
    console.log(`[asaas webhook] suspendendo tenant, matched=${data?.length ?? 0} error=${error?.message ?? "none"}`);
  }

  return new Response("OK", { status: 200 });
}
