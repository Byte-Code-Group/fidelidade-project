import "server-only";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Tool definitions (passed to Claude) ─────────────────────────────────────

export const AI_TOOLS: Tool[] = [
  {
    name: "get_member_info",
    description:
      "Retorna informações da carteirinha do membro: pontos acumulados, código e status.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_appointments",
    description:
      "Lista os agendamentos do membro. Por padrão retorna os próximos (futuros). Passe status='all' para incluir histórico.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["upcoming", "all"],
          description: "Filtro de agendamentos.",
        },
      },
      required: [],
    },
  },
  {
    name: "list_rewards",
    description:
      "Lista as recompensas disponíveis na loja, com custo em pontos e estoque.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_documents",
    description: "Lista os documentos do membro (laudos, receitas, termos).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "list_care_plans",
    description:
      "Lista os planos de acompanhamento/tratamento ativos do membro.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────

interface ToolContext {
  tenantId: string;
  userId: string;
}

type ToolInput = Record<string, string | number | boolean | undefined>;

export async function executeTool(
  name: string,
  input: ToolInput,
  ctx: ToolContext,
): Promise<string> {
  const db = createAdminClient();
  const { tenantId, userId } = ctx;

  switch (name) {
    case "get_member_info": {
      const { data } = await db
        .from("memberships")
        .select("member_code, points_total, status, modality")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!data) return "Carteirinha não encontrada.";
      return JSON.stringify({
        codigo: data.member_code,
        pontos: data.points_total,
        status: data.status,
        modalidade: data.modality,
      });
    }

    case "list_appointments": {
      const upcoming = input.status !== "all";
      let query = db
        .from("appointments")
        .select("title, scheduled_at, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("scheduled_at", { ascending: true })
        .limit(10);

      if (upcoming) {
        query = query
          .gte("scheduled_at", new Date().toISOString())
          .eq("status", "scheduled");
      }

      const { data } = await query;
      if (!data?.length) return "Nenhum agendamento encontrado.";
      return JSON.stringify(
        data.map((a) => ({
          titulo: a.title,
          data: new Date(a.scheduled_at).toLocaleString("pt-BR"),
          status: a.status,
        })),
      );
    }

    case "list_rewards": {
      const { data } = await db
        .from("rewards")
        .select("name, description, points_cost, stock")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("points_cost", { ascending: true })
        .limit(10);

      if (!data?.length) return "Nenhuma recompensa disponível no momento.";
      return JSON.stringify(
        data.map((r) => ({
          nome: r.name,
          descricao: r.description,
          pontos: r.points_cost,
          estoque: r.stock === null ? "ilimitado" : r.stock,
        })),
      );
    }

    case "list_documents": {
      const { data } = await db
        .from("documents")
        .select("title, type, created_at")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!data?.length) return "Nenhum documento encontrado.";
      return JSON.stringify(
        data.map((d) => ({
          titulo: d.title,
          tipo: d.type,
          data: new Date(d.created_at).toLocaleDateString("pt-BR"),
        })),
      );
    }

    case "list_care_plans": {
      const { data } = await db
        .from("care_plans")
        .select("title, description, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!data?.length) return "Nenhum plano de acompanhamento ativo.";
      return JSON.stringify(
        data.map((c) => ({ titulo: c.title, descricao: c.description })),
      );
    }

    default:
      return "Ferramenta desconhecida.";
  }
}
