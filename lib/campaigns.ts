import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzirErro } from "@/lib/error-messages";
import { getCredenciaisWhatsApp } from "@/lib/tenant-whatsapp";
import {
  contarVariaveis,
  enviarTemplate,
  listarTemplates,
  normalizarE164,
  type TemplateCategory,
  type WhatsAppTemplate,
} from "@/lib/whatsapp";

// Campanha de WhatsApp: escolhe um template aprovado na Meta, monta o público
// a partir da base de clientes e dispara em lotes.
//
// Por que template e não texto livre: fora da janela de 24h (cliente falou com
// o número há menos de 24h) a Meta só aceita template aprovado. Campanha por
// definição vai pra quem não está falando com você agora.
//
// Custo: a Meta cobra por mensagem, na conta do próprio negócio. MARKETING é
// cobrado sempre; UTILITY sai de graça pra quem está na janela de 24h. É por
// isso que a fila guarda free_window e o painel mostra a estimativa antes.

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

/** De onde sai cada {{n}} do template, na ordem. */
export type VariableSource =
  | "first_name"
  | "full_name"
  | "points"
  | "member_code"
  | "plan_name"
  | "business_name"
  | "literal";

export interface CampaignVariable {
  source: VariableSource;
  /** Só para source = "literal". */
  value?: string;
}

export interface CampaignAudience {
  /** Status da carteirinha: "active" | "expired" | "suspended" | "" (todos). */
  status?: string;
  /** Id do plano contratado, "" = qualquer. */
  planId?: string;
  minPoints?: number | null;
  maxPoints?: number | null;
  /** Só quem não faz check-in há pelo menos N dias. */
  inactiveDays?: number | null;
}

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  template_name: string;
  template_language: string;
  template_category: TemplateCategory;
  template_body: string | null;
  variables: CampaignVariable[];
  audience: CampaignAudience;
  status: "draft" | "sending" | "sent" | "canceled";
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface Destinatario {
  userId: string;
  phone: string; // E.164 sem "+"
  fullName: string;
  points: number;
  memberCode: string;
  planName: string;
  /** Cliente falou com o número há menos de 24h. */
  freeWindow: boolean;
}

// Preço médio por mensagem no Brasil (BRL), pra estimativa no painel. A Meta
// reajusta e cobra na moeda da conta — por isso a UI diz "aproximado".
const PRECO_BRL: Record<TemplateCategory, number> = {
  MARKETING: 0.3,
  UTILITY: 0.03,
  AUTHENTICATION: 0.19,
};

const JANELA_MS = 24 * 60 * 60 * 1000;

/** Quantas mensagens saem por chamada do disparo — ver dispararLote. */
export const TAMANHO_DO_LOTE = 25;

// ------------------------------------------------------------
// Público
// ------------------------------------------------------------

interface LinhaCliente {
  id: string;
  full_name: string | null;
  phone: string | null;
  wa_last_inbound_at: string | null;
  memberships: {
    status: string;
    points_total: number;
    plan_id: string | null;
    member_code: string;
    business_plans: { name: string } | null;
  }[];
}

/**
 * Quem entra na campanha. Já exclui quem pediu pra sair, quem não tem
 * telefone e quem tem telefone que não vira E.164 — número inválido gasta
 * cota da Meta e volta como erro.
 */
export async function resolverPublico(
  tenantId: string,
  audience: CampaignAudience,
): Promise<Destinatario[]> {
  const db = createAdminClient();

  const { data: linhas } = await db
    .from("users")
    .select(
      "id, full_name, phone, wa_last_inbound_at, memberships(status, points_total, plan_id, member_code, business_plans(name))",
    )
    .eq("tenant_id", tenantId)
    .eq("role", "client")
    .eq("whatsapp_opt_out", false)
    .not("phone", "is", null)
    .returns<LinhaCliente[]>();

  // "Parado há N dias" = sem nenhum check-in depois do corte.
  let ativosRecentes = new Set<string>();
  if (audience.inactiveDays && audience.inactiveDays > 0) {
    const corte = new Date(Date.now() - audience.inactiveDays * 86_400_000).toISOString();
    const { data: checkins } = await db
      .from("checkins")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .gte("created_at", corte)
      .returns<{ user_id: string }[]>();
    ativosRecentes = new Set((checkins ?? []).map((c) => c.user_id));
  }

  const agora = Date.now();
  const destinatarios: Destinatario[] = [];

  for (const linha of linhas ?? []) {
    const phone = normalizarE164(linha.phone);
    if (!phone) continue;

    const ms = linha.memberships[0];
    const status = ms?.status ?? "";
    const pontos = ms?.points_total ?? 0;

    if (audience.status && status !== audience.status) continue;
    if (audience.planId && ms?.plan_id !== audience.planId) continue;
    if (audience.minPoints != null && pontos < audience.minPoints) continue;
    if (audience.maxPoints != null && pontos > audience.maxPoints) continue;
    if (audience.inactiveDays && ativosRecentes.has(linha.id)) continue;

    destinatarios.push({
      userId: linha.id,
      phone,
      fullName: linha.full_name?.trim() || "cliente",
      points: pontos,
      memberCode: ms?.member_code ?? "",
      planName: ms?.business_plans?.name ?? "",
      freeWindow: linha.wa_last_inbound_at
        ? agora - new Date(linha.wa_last_inbound_at).getTime() < JANELA_MS
        : false,
    });
  }

  return destinatarios;
}

/** Preenche os {{n}} do template para um destinatário concreto. */
export function valoresDasVariaveis(
  variaveis: CampaignVariable[],
  dest: Destinatario,
  businessName: string,
): string[] {
  return variaveis.map((v) => {
    switch (v.source) {
      case "first_name":
        return dest.fullName.split(/\s+/)[0];
      case "full_name":
        return dest.fullName;
      case "points":
        return String(dest.points);
      case "member_code":
        return dest.memberCode;
      case "plan_name":
        return dest.planName || "seu plano";
      case "business_name":
        return businessName;
      case "literal":
      default:
        // A Meta recusa parâmetro vazio e qualquer quebra de linha.
        return (v.value ?? "").replace(/\s+/g, " ").trim() || "-";
    }
  });
}

/** Estimativa de gasto da campanha, em BRL. */
export function estimarCusto(
  categoria: TemplateCategory,
  destinatarios: Pick<Destinatario, "freeWindow">[],
): { cobradas: number; gratuitas: number; totalBrl: number } {
  // Só UTILITY fica de graça dentro da janela de 24h; MARKETING é cobrado
  // mesmo com a conversa aberta.
  const gratuitas =
    categoria === "UTILITY" ? destinatarios.filter((d) => d.freeWindow).length : 0;
  const cobradas = destinatarios.length - gratuitas;
  return {
    cobradas,
    gratuitas,
    totalBrl: Number((cobradas * PRECO_BRL[categoria]).toFixed(2)),
  };
}

// ------------------------------------------------------------
// CRUD
// ------------------------------------------------------------

function lerVariaveis(formData: FormData, quantidade: number): CampaignVariable[] {
  const variaveis: CampaignVariable[] = [];
  for (let i = 1; i <= quantidade; i++) {
    const source = String(formData.get(`var_${i}_source`) ?? "literal") as VariableSource;
    const value = String(formData.get(`var_${i}_value`) ?? "").trim();
    variaveis.push(source === "literal" ? { source, value } : { source });
  }
  return variaveis;
}

function lerPublico(formData: FormData): CampaignAudience {
  const numero = (k: string) => {
    const bruto = String(formData.get(k) ?? "").trim();
    if (bruto === "") return null;
    const n = Number(bruto);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    status: String(formData.get("aud_status") ?? "").trim(),
    planId: String(formData.get("aud_plan") ?? "").trim(),
    minPoints: numero("aud_min_points"),
    maxPoints: numero("aud_max_points"),
    inactiveDays: numero("aud_inactive_days"),
  };
}

export async function insertCampaign(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const templateName = String(formData.get("template_name") ?? "").trim();
  if (!name) return { error: "Dê um nome pra campanha." };
  if (!templateName) return { error: "Escolha um template aprovado." };

  const cred = await getCredenciaisWhatsApp(tenantId);
  if (!cred) return { error: "Conecte o WhatsApp do seu negócio antes de criar campanhas." };

  // O template é a fonte da verdade de idioma, categoria e nº de variáveis —
  // nada disso vem do formulário, senão um envio quebra com "132000".
  const { templates, error } = await listarTemplates(cred);
  if (error) return { error };
  const template = templates?.find((t) => t.name === templateName && t.status === "APPROVED");
  if (!template) return { error: "Esse template não está mais aprovado na Meta." };

  const db = createAdminClient();
  const { error: erroInsert } = await db.from("whatsapp_campaigns").insert({
    tenant_id: tenantId,
    name,
    template_name: template.name,
    template_language: template.language,
    template_category: template.category,
    template_body: template.body,
    variables: lerVariaveis(formData, template.variableCount),
    audience: lerPublico(formData),
    status: "draft",
  });
  return { error: erroInsert ? traduzirErro(erroInsert.message) : undefined };
}

export async function applyCampaignUpdate(
  tenantId: string,
  campaignId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { data: atual } = await db
    .from("whatsapp_campaigns")
    .select("status, template_body")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ status: string; template_body: string | null }>();

  if (!atual) return { error: "Campanha não encontrada." };
  // Mexer no texto de uma campanha que já saiu reescreveria o histórico do
  // que os clientes de fato receberam.
  if (atual.status !== "draft") {
    return { error: "Campanha já disparada não pode ser editada." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Dê um nome pra campanha." };

  const { error } = await db
    .from("whatsapp_campaigns")
    .update({
      name,
      variables: lerVariaveis(formData, contarVariaveis(atual.template_body ?? "")),
      audience: lerPublico(formData),
    })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeCampaign(
  tenantId: string,
  campaignId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("whatsapp_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function listCampaigns(tenantId: string): Promise<Campaign[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("whatsapp_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<Campaign[]>();
  return data ?? [];
}

/** Contagem por status de cada campanha, numa consulta só. */
export async function statsDasCampanhas(
  tenantId: string,
): Promise<Record<string, CampaignStats>> {
  const db = createAdminClient();
  const { data } = await db
    .from("whatsapp_messages")
    .select("campaign_id, status")
    .eq("tenant_id", tenantId)
    .returns<{ campaign_id: string; status: keyof CampaignStats }[]>();

  const mapa: Record<string, CampaignStats> = {};
  for (const linha of data ?? []) {
    const s = (mapa[linha.campaign_id] ??= {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    });
    s.total++;
    s[linha.status]++;
  }
  return mapa;
}

export async function templatesDoTenant(
  tenantId: string,
): Promise<{ error?: string; templates: WhatsAppTemplate[] }> {
  const cred = await getCredenciaisWhatsApp(tenantId);
  if (!cred) return { templates: [] };
  const { templates, error } = await listarTemplates(cred);
  return { error, templates: templates ?? [] };
}

// ------------------------------------------------------------
// Disparo
// ------------------------------------------------------------

/**
 * Congela o público numa fila (uma linha por destinatário) e marca a campanha
 * como "sending". Nada é enviado aqui — quem envia é dispararLote.
 *
 * Separar as duas etapas é o que torna o disparo retomável: se o navegador
 * fechar no meio, a fila continua no banco e o botão "continuar" segue de onde
 * parou, sem reenviar pra quem já recebeu.
 */
export async function montarFila(
  tenantId: string,
  campaignId: string,
): Promise<{ error?: string; total?: number }> {
  const db = createAdminClient();
  const { data: campanha } = await db
    .from("whatsapp_campaigns")
    .select("id, status, audience")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ id: string; status: string; audience: CampaignAudience }>();

  if (!campanha) return { error: "Campanha não encontrada." };
  if (campanha.status === "sent") return { error: "Essa campanha já foi enviada." };

  const cred = await getCredenciaisWhatsApp(tenantId);
  if (!cred) return { error: "Conecte o WhatsApp do seu negócio antes de disparar." };

  const publico = await resolverPublico(tenantId, campanha.audience ?? {});
  if (publico.length === 0) {
    return { error: "Nenhum cliente com WhatsApp bate com esses filtros." };
  }

  // ignoreDuplicates: reprocessar a fila não duplica destinatário (o índice
  // único campaign_id + phone segura), então "continuar" é seguro.
  const { error } = await db.from("whatsapp_messages").upsert(
    publico.map((d) => ({
      tenant_id: tenantId,
      campaign_id: campaignId,
      user_id: d.userId,
      phone: d.phone,
      status: "queued",
      free_window: d.freeWindow,
    })),
    { onConflict: "campaign_id,phone", ignoreDuplicates: true },
  );
  if (error) return { error: traduzirErro(error.message) };

  await db
    .from("whatsapp_campaigns")
    .update({ status: "sending", started_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId);

  return { total: publico.length };
}

interface LinhaFila {
  id: string;
  phone: string;
  user_id: string | null;
}

/**
 * Envia o próximo lote da fila. Devolve quantas saíram e quantas ainda faltam
 * — o painel chama de novo até restantes = 0.
 *
 * Lote pequeno de propósito: uma campanha de 2 mil clientes não cabe no tempo
 * de uma única execução de função na Vercel, e um erro no meio perderia tudo.
 */
export async function dispararLote(
  tenantId: string,
  campaignId: string,
): Promise<{ error?: string; enviadas?: number; falhas?: number; restantes?: number }> {
  const db = createAdminClient();

  const { data: campanha } = await db
    .from("whatsapp_campaigns")
    .select("id, status, template_name, template_language, variables")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{
      id: string;
      status: string;
      template_name: string;
      template_language: string;
      variables: CampaignVariable[];
    }>();

  if (!campanha) return { error: "Campanha não encontrada." };
  if (campanha.status === "canceled") return { error: "Campanha cancelada." };

  const cred = await getCredenciaisWhatsApp(tenantId);
  if (!cred) return { error: "WhatsApp desconectado. Reconecte o número." };

  const { data: negocio } = await db
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle<{ name: string }>();

  const { data: fila } = await db
    .from("whatsapp_messages")
    .select("id, phone, user_id")
    .eq("campaign_id", campaignId)
    .eq("tenant_id", tenantId)
    .eq("status", "queued")
    .limit(TAMANHO_DO_LOTE)
    .returns<LinhaFila[]>();

  if (!fila || fila.length === 0) {
    await encerrarSeVazia(tenantId, campaignId);
    return { enviadas: 0, falhas: 0, restantes: 0 };
  }

  // Os dados de personalização vêm do público resolvido AGORA, indexado por
  // telefone — a fila guarda só o destino, não a cópia dos pontos do cliente.
  const publico = await resolverPublico(tenantId, {});
  const porTelefone = new Map(publico.map((d) => [d.phone, d]));

  let enviadas = 0;
  let falhas = 0;

  // Em série de propósito: a Meta limita a taxa de envio por número e um
  // burst paralelo volta como 130429 pra metade do lote.
  for (const item of fila) {
    const dest = porTelefone.get(item.phone);
    const valores = dest
      ? valoresDasVariaveis(campanha.variables ?? [], dest, negocio?.name ?? "")
      : (campanha.variables ?? []).map((v) => (v.source === "literal" ? (v.value ?? "-") : "-"));

    const { messageId, error } = await enviarTemplate(cred, {
      to: item.phone,
      template: campanha.template_name,
      language: campanha.template_language,
      variaveis: valores,
    });

    if (error) {
      falhas++;
      await db
        .from("whatsapp_messages")
        .update({ status: "failed", error, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } else {
      enviadas++;
      await db
        .from("whatsapp_messages")
        .update({
          status: "sent",
          wa_message_id: messageId ?? null,
          error: null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }

  const { count } = await db
    .from("whatsapp_messages")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  const restantes = count ?? 0;
  if (restantes === 0) await encerrarSeVazia(tenantId, campaignId);

  return { enviadas, falhas, restantes };
}

async function encerrarSeVazia(tenantId: string, campaignId: string) {
  const db = createAdminClient();
  await db
    .from("whatsapp_campaigns")
    .update({ status: "sent", finished_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .eq("status", "sending");
}

/** Interrompe uma campanha em andamento — o que já saiu não volta. */
export async function cancelarCampanha(
  tenantId: string,
  campaignId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("whatsapp_campaigns")
    .update({ status: "canceled", finished_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .eq("status", "sending");
  return { error: error ? traduzirErro(error.message) : undefined };
}
