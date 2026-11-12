import { google } from "@ai-sdk/google";
import { streamText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientDataText, generateClientDocument } from "@/lib/agent-hub";
import { DEFAULT_TIMEZONE } from "@/lib/scheduling";

const MAX_MSG_LENGTH = 2000;
const MAX_HISTORY = 20;

// Assistente do dono no painel: acha clientes e gera documentos pelos modelos.
// O tenant vem do cookie validado em getTenantOwner — nunca do corpo da request.
// shortcut: não grava conversa nem conta na cota de IA do portal; ligar se o uso crescer.
export async function POST(req: Request) {
  const owner = await getTenantOwner();
  if (!owner) return new Response("Unauthorized", { status: 401 });
  const { tenantId } = owner;

  const body = await req.json().catch(() => null);
  const raw: unknown = body?.messages;
  if (!Array.isArray(raw) || !raw.length) return new Response("No messages", { status: 400 });
  const ok = raw.every(
    (m) =>
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length <= MAX_MSG_LENGTH,
  );
  if (!ok) return new Response("Invalid messages", { status: 400 });
  const messages = (raw as { role: "user" | "assistant"; content: string }[])
    .slice(-MAX_HISTORY)
    .map(({ role, content }) => ({ role, content }));

  const db = createAdminClient();
  const tenantName = owner.tenants.find((t) => t.id === tenantId)?.name ?? "o negócio";
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "full" });

  const tools = {
    search_clients: tool({
      description: "Busca clientes do negócio pelo nome, e-mail ou telefone. Sem termo, lista os mais recentes.",
      inputSchema: z.object({ query: z.string().max(100).optional() }),
      execute: async ({ query }) => {
        let q = db
          .from("users")
          .select("id, full_name, email, phone")
          .eq("tenant_id", tenantId)
          .eq("role", "client")
          .order("created_at", { ascending: false })
          .limit(10);
        const term = query?.replace(/[%,()]/g, " ").trim();
        if (term) q = q.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
        const { data } = await q;
        return data?.length ? JSON.stringify(data) : "Nenhum cliente encontrado.";
      },
    }),

    get_client: tool({
      description: "Dados completos de um cliente (cadastro, campos de perfil, carteirinha e pontos).",
      inputSchema: z.object({ client_id: z.string().uuid() }),
      execute: async ({ client_id }) => (await clientDataText(tenantId, client_id)) ?? "Cliente não encontrado.",
    }),

    list_document_templates: tool({
      description: "Lista os modelos de documento cadastrados pelo negócio.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db
          .from("document_templates")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .order("display_order");
        return data?.length ? JSON.stringify(data) : "Nenhum modelo de documento cadastrado.";
      },
    }),

    generate_document: tool({
      description:
        "Gera com IA um documento a partir de um modelo, preenchido com os dados do cliente, e salva na aba Documentos dele. Pode levar até 2 minutos.",
      inputSchema: z.object({
        client_id: z.string().uuid(),
        template_id: z.string().uuid(),
        instructions: z
          .string()
          .max(2000)
          .optional()
          .describe("Detalhes do caso que não estão no cadastro (ex.: 'atestado de 2 dias a partir de hoje')."),
      }),
      execute: async ({ client_id, template_id, instructions }) => {
        const r = await generateClientDocument(tenantId, client_id, template_id, instructions ?? "");
        if (r.error) return `Erro: ${r.error}`;
        return (
          `Documento salvo na aba Documentos do cliente (/painel/clientes/${client_id}).` +
          (r.emptyFields?.length ? ` Campos sem dado: ${r.emptyFields.join(", ")}.` : "")
        );
      },
    }),
  };

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: `Você é o assistente do painel de ${tenantName}. Quem fala com você é o dono do negócio. Hoje é ${today}.
Responda em português brasileiro, curto e direto, em markdown simples.
Para gerar um documento: ache o cliente com search_clients (se vier mais de um, pergunte qual), ache o modelo com list_document_templates e chame generate_document. Não peça dado que já está no cadastro; o que faltar vai em instructions ou fica em branco no documento.
Só diga que gerou depois que generate_document confirmar. Se der erro, mostre o erro. Nunca invente cliente, modelo ou dado.`,
    messages,
    tools,
    stopWhen: stepCountIs(8),
  });
  return result.toTextStreamResponse();
}
