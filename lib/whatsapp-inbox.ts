import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// O que fazer com o que chega do WhatsApp, independente de quem trouxe.
//
// Meta e Evolution mandam formatos completamente diferentes, mas depois de
// decodificado o evento é sempre um dos dois casos abaixo. As rotas em
// app/api/webhooks/{whatsapp,evolution} só traduzem o payload e chamam aqui.

export type StatusEntrega = "sent" | "delivered" | "read" | "failed";

// Um status atrasado não pode rebaixar o que já avançou: "read" chegando antes
// de "delivered" acontece, e regravar "delivered" mentiria no relatório.
const ORDEM: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 3,
};

const PALAVRAS_DE_SAIDA =
  /^\s*(sair|parar|pare|cancelar|descadastrar|stop|unsubscribe)\s*$/i;

/**
 * Avança o status de uma mensagem da fila. Silencioso quando o id não é de uma
 * campanha nossa — o webhook recebe eventos de qualquer conversa do número.
 */
export async function aplicarStatusEntrega(
  tenantId: string,
  evento: { messageId: string; status: StatusEntrega; erro?: string | null },
): Promise<void> {
  const db = createAdminClient();
  const { data: atual } = await db
    .from("whatsapp_messages")
    .select("id, status")
    .eq("tenant_id", tenantId)
    .eq("wa_message_id", evento.messageId)
    .maybeSingle<{ id: string; status: string }>();

  if (!atual) return;
  if ((ORDEM[evento.status] ?? 0) <= (ORDEM[atual.status] ?? 0)) return;

  await db
    .from("whatsapp_messages")
    .update({
      status: evento.status,
      error: evento.erro ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", atual.id);
}

/**
 * Cliente respondeu: abre a janela de 24h e, se escreveu "SAIR", encerra o
 * consentimento pra sempre.
 */
export async function registrarMensagemRecebida(
  tenantId: string,
  evento: { de: string; quandoMs?: number; texto?: string },
): Promise<void> {
  const db = createAdminClient();

  // O telefone no banco pode estar com máscara e o provedor manda só dígitos.
  // Casar pelos últimos 8 evita erro com o 9 extra de celular antigo.
  const { data: candidatos } = await db
    .from("users")
    .select("id, phone")
    .eq("tenant_id", tenantId)
    .not("phone", "is", null)
    .returns<{ id: string; phone: string }[]>();

  const finalRecebido = evento.de.replace(/\D/g, "").slice(-8);
  if (finalRecebido.length < 8) return;

  const cliente = (candidatos ?? []).find(
    (c) => c.phone.replace(/\D/g, "").slice(-8) === finalRecebido,
  );
  if (!cliente) return;

  await db
    .from("users")
    .update({
      wa_last_inbound_at: new Date(evento.quandoMs ?? Date.now()).toISOString(),
      ...(PALAVRAS_DE_SAIDA.test(evento.texto ?? "") && { whatsapp_opt_out: true }),
    })
    .eq("id", cliente.id)
    .eq("tenant_id", tenantId);
}
