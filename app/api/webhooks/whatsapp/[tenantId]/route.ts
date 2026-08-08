import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantDoWebhook } from "@/lib/tenant-whatsapp";

// Webhook do WhatsApp Cloud API de UM negócio.
//
// Traz duas coisas:
//  • statuses — sent/delivered/read/failed de cada mensagem disparada;
//  • messages — o cliente respondeu. Isso abre a janela de 24h (e, se ele
//    escreveu "SAIR", encerra o consentimento).
//
// A URL é cadastrada no painel da Meta pelo dono do negócio, com o
// verify_token que o painel mostra (ver lib/tenant-whatsapp.ts).

interface StatusDaMeta {
  id?: string;
  status?: string;
  errors?: { title?: string; message?: string; error_data?: { details?: string } }[];
}

interface MensagemDaMeta {
  from?: string;
  timestamp?: string;
  text?: { body?: string };
}

interface CorpoDoWebhook {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        statuses?: StatusDaMeta[];
        messages?: MensagemDaMeta[];
      };
    }[];
  }[];
}

// Status que a Meta manda vs. o que a fila guarda. "accepted" e "deleted" não
// interessam: não mudam o que o cliente viu.
const STATUS_VALIDOS = new Set(["sent", "delivered", "read", "failed"]);

// Um status atrasado não pode rebaixar o que já avançou: "read" chegando antes
// de "delivered" acontece, e regravar "delivered" mentiria no relatório.
const ORDEM: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3, failed: 3 };

const PALAVRAS_DE_SAIDA = /^\s*(sair|parar|pare|cancelar|descadastrar|stop|unsubscribe)\s*$/i;

// ------------------------------------------------------------
// Verificação do endpoint (a Meta chama uma vez ao cadastrar a URL)
// ------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const query = req.nextUrl.searchParams;

  const autorizado = await tenantDoWebhook(tenantId, query.get("hub.verify_token"));
  if (query.get("hub.mode") !== "subscribe" || !autorizado) {
    return new Response("Forbidden", { status: 403 });
  }
  // A Meta só aceita a URL se receber o challenge de volta, cru.
  return new Response(query.get("hub.challenge") ?? "", { status: 200 });
}

// ------------------------------------------------------------
// Eventos
// ------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;
  const bruto = await req.text();

  if (!assinaturaConfere(bruto, req.headers.get("x-hub-signature-256"))) {
    console.error("[whatsapp webhook] assinatura invalida", { tenantId });
    return new Response("Unauthorized", { status: 401 });
  }

  let corpo: CorpoDoWebhook;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const db = createAdminClient();

  // Confere que o evento é mesmo do número desse negócio — o payload não pode
  // mandar escrever na fila de outro tenant.
  const { data: conta } = await db
    .from("tenant_whatsapp_accounts")
    .select("phone_number_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ phone_number_id: string }>();
  if (!conta) return new Response("OK — negócio sem WhatsApp", { status: 200 });

  for (const entry of corpo.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value) continue;
      if (value.metadata?.phone_number_id !== conta.phone_number_id) continue;

      for (const status of value.statuses ?? []) {
        await aplicarStatus(tenantId, status);
      }
      for (const mensagem of value.messages ?? []) {
        await aplicarMensagemRecebida(tenantId, mensagem);
      }
    }
  }

  // Sempre 200: erro aqui faz a Meta reenviar em loop e, depois de muitas
  // falhas, desinscrever o app da conta do negócio.
  return new Response("OK", { status: 200 });
}

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET;
  // Sem segredo configurado a checagem de tenant/phone_number_id ainda vale —
  // o app secret é único da plataforma, não de cada negócio.
  if (!segredo) return true;
  if (!cabecalho?.startsWith("sha256=")) return false;

  const esperado = Buffer.from(
    `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`,
  );
  const recebido = Buffer.from(cabecalho);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}

async function aplicarStatus(tenantId: string, status: StatusDaMeta) {
  if (!status.id || !status.status || !STATUS_VALIDOS.has(status.status)) return;

  const db = createAdminClient();
  const { data: atual } = await db
    .from("whatsapp_messages")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("wa_message_id", status.id)
    .maybeSingle<{ id: string; status: string }>();

  if (!atual) return;
  if ((ORDEM[status.status] ?? 0) <= (ORDEM[atual.status] ?? 0)) return;

  const erro = status.errors?.[0];
  await db
    .from("whatsapp_messages")
    .update({
      status: status.status,
      error: erro ? (erro.error_data?.details ?? erro.title ?? "Falha na entrega") : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", atual.id);
}

async function aplicarMensagemRecebida(tenantId: string, mensagem: MensagemDaMeta) {
  if (!mensagem.from) return;

  const db = createAdminClient();
  const quandoMs = mensagem.timestamp ? Number(mensagem.timestamp) * 1000 : Date.now();
  const texto = mensagem.text?.body ?? "";

  // O telefone no banco pode estar com máscara; a Meta manda só dígitos. Casar
  // pelos últimos 8 dígitos evita erro com o 9 extra de celular antigo.
  const { data: candidatos } = await db
    .from("users")
    .select("id, phone")
    .eq("tenant_id", tenantId)
    .not("phone", "is", null)
    .returns<{ id: string; phone: string }[]>();

  const finalRecebido = mensagem.from.replace(/\D/g, "").slice(-8);
  const cliente = (candidatos ?? []).find(
    (c) => c.phone.replace(/\D/g, "").slice(-8) === finalRecebido,
  );
  if (!cliente) return;

  await db
    .from("users")
    .update({
      wa_last_inbound_at: new Date(quandoMs).toISOString(),
      // Pediu pra sair: nenhuma campanha futura inclui esse cliente.
      ...(PALAVRAS_DE_SAIDA.test(texto) && { whatsapp_opt_out: true }),
    })
    .eq("id", cliente.id)
    .eq("tenant_id", tenantId);
}
