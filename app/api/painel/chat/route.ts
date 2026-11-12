import { getTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientDataText, generateClientDocument, hubChat, type ChatMessage } from "@/lib/agent-hub";
import { DEFAULT_TIMEZONE } from "@/lib/scheduling";

const MAX_MSG_LENGTH = 2000;
const MAX_HISTORY = 20;
const CHAT_AGENT = process.env.BYTE_AGENT_HUB_CHAT_AGENT ?? "fidelidade-assistente";
// O hub não tem tool calling: o agent pede uma ação numa linha <<ACAO ...>> e esta rota executa.
const ACTION = /<<\s*(GERAR|DADOS)\s+([\s\S]*?)>>/;

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

// Assistente do dono no painel, pelo Byte Agent Hub: acha clientes e gera documentos.
// O tenant vem do cookie validado em getTenantOwner — nunca do corpo da request.
export async function POST(req: Request) {
  const owner = await getTenantOwner();
  if (!owner) return text("Unauthorized", 401);
  const { tenantId } = owner;

  const body = await req.json().catch(() => null);
  const raw: unknown = body?.messages;
  if (!Array.isArray(raw) || !raw.length) return text("No messages", 400);
  const ok = raw.every(
    (m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.length <= MAX_MSG_LENGTH,
  );
  if (!ok || raw[raw.length - 1].role !== "user") return text("Invalid messages", 400);
  const history = (raw as ChatMessage[]).slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content }));

  const db = createAdminClient();
  // shortcut: lista até 300 clientes no contexto; negócio maior precisa de busca no lugar da lista.
  const [{ data: clients }, { data: templates }] = await Promise.all([
    db
      .from("users")
      .select("id, full_name, email, phone")
      .eq("tenant_id", tenantId)
      .eq("role", "client")
      .order("full_name")
      .limit(300),
    db.from("document_templates").select("id, name").eq("tenant_id", tenantId).order("display_order"),
  ]);
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.full_name ?? c.email ?? "cliente"]));
  const templateName = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const tenantName = owner.tenants.find((t) => t.id === tenantId)?.name ?? "o negócio";
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: DEFAULT_TIMEZONE, dateStyle: "full" });
  const context = `[CONTEXTO DO SISTEMA — não repita isto ao usuário]
Você é o assistente do painel de ${tenantName}. Quem fala é o dono do negócio. Hoje é ${today}.
Responda em português brasileiro, curto, em markdown simples. Nunca invente cliente, modelo ou dado.

Clientes (id | nome | e-mail | telefone):
${(clients ?? []).map((c) => `${c.id} | ${c.full_name ?? ""} | ${c.email ?? ""} | ${c.phone ?? ""}`).join("\n") || "(nenhum cliente)"}

Modelos de documento (id | nome):
${(templates ?? []).map((t) => `${t.id} | ${t.name}`).join("\n") || "(nenhum modelo cadastrado)"}

Ações — quando precisar de uma, responda SÓ com a linha da ação, sem mais nada:
- Gerar documento: <<GERAR {"cliente":"<id do cliente>","modelo":"<id do modelo>","instrucoes":"<detalhes do caso que não estão no cadastro, ou vazio>"}>>
- Ver dados completos de um cliente (cadastro, CPF, pontos, carteirinha): <<DADOS <id do cliente>>>
Se o pedido for ambíguo (mais de um cliente com o nome, modelo não existe), pergunte antes. Não peça dado que já está no cadastro: o que faltar vai em instrucoes.
[FIM DO CONTEXTO]

`;

  const last = history.length - 1;
  const messages: ChatMessage[] = history.map((m, i) => (i === last ? { ...m, content: context + m.content } : m));

  for (let step = 0; step < 3; step++) {
    const { output, error } = await hubChat(CHAT_AGENT, messages);
    if (error || output === undefined) return text(`Não consegui responder (${error}).`);

    const action = output.match(ACTION);
    if (!action) return text(output.trim() || "Não consegui responder agora. Tente de novo.");
    messages.push({ role: "assistant", content: output });

    if (action[1] === "DADOS") {
      const id = action[2].trim();
      const data = clientName.has(id) ? await clientDataText(tenantId, id) : null;
      messages.push({ role: "user", content: `[RESULTADO DO SISTEMA]\n${data ?? "Cliente não encontrado."}\nAgora responda ao dono.` });
      continue;
    }

    let args: { cliente?: string; modelo?: string; instrucoes?: string };
    try {
      args = JSON.parse(action[2]);
    } catch {
      return text("Não entendi qual documento gerar. Pode repetir o pedido com o nome do cliente e do modelo?");
    }
    const cliente = String(args.cliente ?? "");
    const modelo = String(args.modelo ?? "");
    if (!clientName.has(cliente) || !templateName.has(modelo)) {
      return text("Não achei esse cliente ou esse modelo. Confira os nomes e peça de novo.");
    }
    const r = await generateClientDocument(tenantId, cliente, modelo, String(args.instrucoes ?? "").slice(0, 2000));
    if (r.error) return text(`Não consegui gerar o documento: ${r.error}`);
    return text(
      `Pronto! **${templateName.get(modelo)}** de **${clientName.get(cliente)}** gerado e salvo na aba Documentos do cliente.` +
        (r.emptyFields?.length ? `\n\nFicaram sem dado: ${r.emptyFields.join(", ")}.` : ""),
    );
  }
  return text("Não consegui concluir o pedido. Tente de novo com mais detalhes.");
}
