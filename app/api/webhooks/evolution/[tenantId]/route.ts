import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jidParaE164 } from "@/lib/evolution";
import {
  aplicarStatusEntrega,
  registrarMensagemRecebida,
  type StatusEntrega,
} from "@/lib/whatsapp-inbox";

// Webhook do Evolution API de UM negócio (conexão por QR code).
//
// Mesmo papel do webhook da Meta em ../whatsapp: status de entrega e mensagem
// recebida. O que muda é a autenticação e o vocabulário.
//
// O Evolution não assina o corpo como a Meta faz com HMAC — ele só chama a URL
// cadastrada. Por isso o segredo do negócio vai na própria query (`?t=`), que
// só a plataforma e o servidor Evolution conhecem. É por isso também que a URL
// nunca é exibida no painel nesse caminho: ela É a credencial.

/** Status do Baileys → o que a fila guarda. */
const STATUS: Record<string, StatusEntrega> = {
  PENDING: "sent",
  SERVER_ACK: "sent",
  DELIVERY_ACK: "delivered",
  READ: "read",
  PLAYED: "read",
  ERROR: "failed",
};

interface DadosDeAtualizacao {
  keyId?: string;
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  status?: string;
  remoteJid?: string;
}

interface DadosDeMensagem {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean };
  messageTimestamp?: number | string;
  message?: {
    conversation?: string;
    extendedTextMessage?: { text?: string };
  };
}

interface CorpoDoWebhook {
  event?: string;
  instance?: string;
  data?: DadosDeAtualizacao | DadosDeMensagem | (DadosDeAtualizacao | DadosDeMensagem)[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;

  if (!(await tokenConfere(tenantId, req.nextUrl.searchParams.get("t")))) {
    console.error("[evolution webhook] token invalido", { tenantId });
    return new Response("Unauthorized", { status: 401 });
  }

  let corpo: CorpoDoWebhook;
  try {
    corpo = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  // O evento vem em maiúsculas com underline em algumas versões e em
  // minúsculas com ponto em outras.
  const evento = (corpo.event ?? "").toUpperCase().replace(/\./g, "_");
  const itens = Array.isArray(corpo.data) ? corpo.data : corpo.data ? [corpo.data] : [];

  for (const item of itens) {
    if (evento === "MESSAGES_UPDATE") {
      await tratarAtualizacao(tenantId, item as DadosDeAtualizacao);
    } else if (evento === "MESSAGES_UPSERT") {
      await tratarMensagem(tenantId, item as DadosDeMensagem);
    }
  }

  // Sempre 200: erro aqui faz o Evolution reenfileirar e repetir por dez
  // tentativas, e nada do que acontece acima é recuperável por retentativa.
  return new Response("OK", { status: 200 });
}

async function tratarAtualizacao(tenantId: string, dados: DadosDeAtualizacao) {
  const messageId = dados.keyId ?? dados.key?.id;
  const status = STATUS[(dados.status ?? "").toUpperCase()];
  if (!messageId || !status) return;

  await aplicarStatusEntrega(tenantId, {
    messageId,
    status,
    erro: status === "failed" ? "O WhatsApp não entregou a mensagem." : null,
  });
}

async function tratarMensagem(tenantId: string, dados: DadosDeMensagem) {
  // fromMe é o que o próprio negócio mandou (inclusive pelo celular): não é
  // resposta de cliente e não abre janela nenhuma.
  if (dados.key?.fromMe) return;

  const jid = dados.key?.remoteJid ?? "";
  // Grupo e status/broadcast não são cliente — ignora.
  if (!jid || !jid.endsWith("@s.whatsapp.net")) return;

  const timestamp = Number(dados.messageTimestamp ?? 0);
  await registrarMensagemRecebida(tenantId, {
    de: jidParaE164(jid),
    // O Baileys manda em segundos.
    quandoMs: timestamp > 0 ? timestamp * 1000 : undefined,
    texto: dados.message?.conversation ?? dados.message?.extendedTextMessage?.text ?? "",
  });
}

/** Confere o segredo da URL contra o verify_token daquele negócio. */
async function tokenConfere(tenantId: string, token: string | null): Promise<boolean> {
  if (!token) return false;

  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select("verify_token, provider")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ verify_token: string; provider: string }>();

  if (!data || data.provider !== "evolution") return false;

  const esperado = Buffer.from(data.verify_token);
  const recebido = Buffer.from(token);
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
}
