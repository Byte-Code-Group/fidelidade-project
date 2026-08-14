import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantDoWebhook } from "@/lib/tenant-whatsapp";
import {
  aplicarStatusEntrega,
  registrarMensagemRecebida,
  type StatusEntrega,
} from "@/lib/whatsapp-inbox";

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
        if (!status.id || !status.status || !STATUS_VALIDOS.has(status.status)) continue;
        const erro = status.errors?.[0];
        await aplicarStatusEntrega(tenantId, {
          messageId: status.id,
          status: status.status as StatusEntrega,
          erro: erro
            ? (erro.error_data?.details ?? erro.title ?? "Falha na entrega")
            : null,
        });
      }
      for (const mensagem of value.messages ?? []) {
        if (!mensagem.from) continue;
        await registrarMensagemRecebida(tenantId, {
          de: mensagem.from,
          quandoMs: mensagem.timestamp ? Number(mensagem.timestamp) * 1000 : undefined,
          texto: mensagem.text?.body,
        });
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
