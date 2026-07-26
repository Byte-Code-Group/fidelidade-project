import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantDoWebhook } from "@/lib/tenant-asaas";

// Webhook da conta Asaas de UM negócio — criado por nós quando ele conecta a
// conta (ver conectarAsaas). Mantém o status da assinatura do cliente final
// em memberships.
//
// Não confundir com /api/webhooks/asaas, que é da conta da plataforma e mexe
// no status do tenant.

const PAGOU = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"]);
const ATRASOU = new Set(["PAYMENT_OVERDUE"]);
const ENCERROU = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;

  // O token é único por negócio: um webhook de outra conta não mexe aqui.
  const autorizado = await tenantDoWebhook(
    tenantId,
    req.headers.get("asaas-access-token"),
  );
  if (!autorizado) {
    console.error("[asaas webhook tenant] token invalido", { tenantId });
    return new Response("Unauthorized", { status: 401 });
  }

  let body: {
    event?: string;
    payment?: { subscription?: string };
    subscription?: { id?: string };
  };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const event = body.event ?? "";
  const subscriptionId = body.subscription?.id ?? body.payment?.subscription ?? null;
  if (!subscriptionId) return new Response("OK — sem assinatura", { status: 200 });

  const status = PAGOU.has(event)
    ? "active"
    : ATRASOU.has(event)
      ? "overdue"
      : ENCERROU.has(event)
        ? "canceled"
        : null;

  if (!status) return new Response("OK — evento ignorado", { status: 200 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("memberships")
    .update({ subscription_status: status, subscription_updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("asaas_subscription_id", subscriptionId)
    .select("id");

  console.log(
    `[asaas webhook tenant] tenant=${tenantId} event=${event} status=${status} matched=${data?.length ?? 0} error=${error?.message ?? "none"}`,
  );

  return new Response("OK", { status: 200 });
}
