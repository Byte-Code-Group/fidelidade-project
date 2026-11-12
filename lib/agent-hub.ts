import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, documentPath, pathBelongsTo } from "@/lib/storage";
import { DEFAULT_TIMEZONE } from "@/lib/scheduling";

/**
 * Geração de documento pelo dono via Byte Agent Hub.
 *
 * Dois agents no hub (conta da plataforma, chave em BYTE_AGENT_HUB_KEY):
 * - TEMPLATE: output "template". Recebe o .docx do modelo com campos
 *   {{ campo }} e devolve o mesmo .docx preenchido — layout intacto.
 * - DOCX: output "docx". Para modelos sem campos (PDF, texto colado): recebe
 *   o texto do modelo e escreve o documento inteiro.
 */
const HUB_URL = process.env.BYTE_AGENT_HUB_URL ?? "https://byte-agent-hub.bytecodegroup.com.br";
const TEMPLATE_AGENT = process.env.BYTE_AGENT_HUB_TEMPLATE_AGENT ?? "fidelidade-modelo";
const DOCX_AGENT = process.env.BYTE_AGENT_HUB_DOCX_AGENT ?? "fidelidade-documento";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const hasPlaceholders = (text: string) => /\{\{\s*[^}]+\}\}/.test(text);

// Tudo que a plataforma sabe do cliente, em texto — é daqui que a IA tira os valores.
export async function clientDataText(tenantId: string, userId: string) {
  const db = createAdminClient();
  const [{ data: tenant }, { data: user }, { data: membership }, { data: fields }, { data: values }] =
    await Promise.all([
      db.from("tenants").select("name").eq("id", tenantId).maybeSingle<{ name: string }>(),
      db
        .from("users")
        .select("full_name, email, created_at")
        .eq("id", userId)
        .eq("tenant_id", tenantId)
        .maybeSingle<{ full_name: string | null; email: string | null; created_at: string }>(),
      db
        .from("memberships")
        .select("member_code, points_total, status, modality, valid_until")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db.from("profile_fields").select("id, label").eq("tenant_id", tenantId).order("display_order"),
      db.from("profile_field_values").select("field_id, value").eq("tenant_id", tenantId).eq("user_id", userId),
    ]);
  if (!user) return null;

  const fmt = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: DEFAULT_TIMEZONE });
  const valueByField = new Map((values ?? []).map((v) => [v.field_id, v.value]));
  const lines = [
    `Empresa emissora: ${tenant?.name ?? ""}`,
    `Data de hoje: ${fmt(new Date().toISOString())}`,
    `Nome do cliente: ${user.full_name ?? ""}`,
    `E-mail do cliente: ${user.email ?? ""}`,
    `Cliente desde: ${fmt(user.created_at)}`,
    ...(fields ?? []).map((f) => `${f.label}: ${valueByField.get(f.id) ?? ""}`),
  ];
  if (membership) {
    lines.push(
      `Código da carteirinha: ${membership.member_code}`,
      `Pontos: ${membership.points_total}`,
      `Status da carteirinha: ${membership.status}`,
      `Modalidade: ${membership.modality}`,
      `Válida até: ${membership.valid_until ? fmt(membership.valid_until) : "sem prazo"}`,
    );
  }
  return lines.join("\n");
}

async function callHub(agent: string, body: FormData) {
  const key = process.env.BYTE_AGENT_HUB_KEY;
  if (!key) return { error: "Geração de documentos não configurada (BYTE_AGENT_HUB_KEY)." };

  let res: Response;
  try {
    res = await fetch(`${HUB_URL}/api/agents/${agent}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(120_000),
    });
  } catch (e) {
    console.error("[agent-hub]", agent, e);
    return { error: "Não consegui falar com o serviço de IA. Tente de novo." };
  }

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "" }));
    console.error("[agent-hub]", agent, res.status, error);
    return { error: `A IA não conseguiu gerar o documento${error ? `: ${error}` : "."}` };
  }
  if (!res.headers.get("content-type")?.includes(DOCX_MIME)) {
    // 200 sem .docx = o agent no hub está com saída "Texto".
    const expected = agent === TEMPLATE_AGENT ? "Template" : "DOCX";
    return { error: `o agent "${agent}" no Byte Agent Hub precisa estar com saída ${expected}, não Texto.` };
  }
  return {
    file: new Uint8Array(await res.arrayBuffer()),
    emptyFields: (res.headers.get("x-empty-fields") ?? "").split(",").filter(Boolean),
  };
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Conversa com um agent de texto do hub (assistente do painel). */
export async function hubChat(agent: string, messages: ChatMessage[]): Promise<{ output?: string; error?: string }> {
  const key = process.env.BYTE_AGENT_HUB_KEY;
  if (!key) return { error: "IA não configurada (BYTE_AGENT_HUB_KEY)." };
  try {
    const res = await fetch(`${HUB_URL}/api/agents/${agent}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[agent-hub]", agent, res.status, data.error);
      return { error: `a IA recusou${data.error ? `: ${data.error}` : ""}` };
    }
    return { output: String(data.output ?? "") };
  } catch (e) {
    console.error("[agent-hub]", agent, e);
    return { error: "não consegui falar com o serviço de IA" };
  }
}

/** Gera o documento do modelo com os dados do cliente e salva na aba Documentos dele. */
export async function generateClientDocument(
  tenantId: string,
  userId: string,
  templateId: string,
  instructions: string,
): Promise<{ error?: string; emptyFields?: string[] }> {
  const db = createAdminClient();
  const { data: template } = await db
    .from("document_templates")
    .select("name, content, file_url, file_name")
    .eq("id", templateId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ name: string; content: string; file_url: string | null; file_name: string | null }>();
  if (!template) return { error: "Modelo não encontrado." };

  const data = await clientDataText(tenantId, userId);
  if (!data) return { error: "Cliente não encontrado." };

  const input = [
    "Dados do cliente cadastrados na plataforma:",
    data,
    instructions && `\nInstruções de quem está emitindo o documento:\n${instructions}`,
  ]
    .filter(Boolean)
    .join("\n");

  const body = new FormData();
  let agent = DOCX_AGENT;
  const isDocx = template.file_name?.toLowerCase().endsWith(".docx");
  if (isDocx && template.file_url && pathBelongsTo(template.file_url, tenantId) && hasPlaceholders(template.content)) {
    const { data: file, error } = await db.storage.from(BUCKETS.documentTemplates).download(template.file_url);
    if (error || !file) return { error: "Não consegui ler o arquivo do modelo." };
    agent = TEMPLATE_AGENT;
    body.append("files", new File([file], template.file_name!, { type: DOCX_MIME }));
    body.append("input", input);
  } else {
    body.append(
      "input",
      `Gere o documento "${template.name}" seguindo este modelo, preenchido com os dados do cliente. ` +
        `Dado que não existir fica como [A PREENCHER].\n\n--- Modelo ---\n${template.content}\n\n${input}`,
    );
  }

  const result = await callHub(agent, body);
  if (!result.file) return { error: result.error };

  const path = documentPath(tenantId, userId, "ia", "docx");
  const { error: upErr } = await db.storage
    .from(BUCKETS.documents)
    .upload(path, result.file, { contentType: DOCX_MIME, upsert: false });
  if (upErr) return { error: "Não consegui salvar o documento gerado." };

  const { error } = await db.from("documents").insert({
    tenant_id: tenantId,
    user_id: userId,
    category: "documentos",
    title: `${template.name} — ${new Date().toLocaleDateString("pt-BR", { timeZone: DEFAULT_TIMEZONE })}`,
    file_url: path,
    source: "ia",
  });
  if (error) {
    await db.storage.from(BUCKETS.documents).remove([path]);
    return { error: "Não consegui salvar o documento gerado." };
  }
  return { emptyFields: result.emptyFields };
}
