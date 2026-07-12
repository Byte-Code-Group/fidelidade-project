import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

interface ToolContext {
  tenantId: string;
  userId: string;
}

// Ferramentas do assistente — uma por consulta de dados do membro. `getAiTools`
// fecha sobre tenantId/userId da request atual (streamText não passa contexto
// arbitrário pro execute, só o input validado pelo schema).
export function getAiTools(ctx: ToolContext) {
  const db = createAdminClient();
  const { tenantId, userId } = ctx;

  return {
    get_member_info: tool({
      description:
        "Retorna informações da carteirinha do membro: pontos acumulados, código e status.",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    request_appointment: tool({
      description:
        "Solicita um novo agendamento/consulta pro membro. Use quando o cliente pedir pra marcar, agendar ou remarcar uma visita — pergunte antes o motivo/tipo de consulta e a data e horário preferidos, se ele não tiver informado.",
      inputSchema: z.object({
        title: z
          .string()
          .describe("Motivo ou tipo da consulta, ex: 'Avaliação — dor de dente'."),
        scheduled_at: z
          .string()
          .describe(
            "Data e horário desejados em ISO 8601 (ex: 2026-07-15T14:00:00). Assuma o fuso local do Brasil.",
          ),
        notes: z.string().optional().describe("Observações adicionais do cliente."),
      }),
      execute: async ({ title, scheduled_at, notes }) => {
        const date = new Date(scheduled_at);
        if (Number.isNaN(date.getTime())) {
          return "Não entendi a data informada. Peça pro cliente confirmar dia e horário.";
        }
        const { error } = await db.from("appointments").insert({
          tenant_id: tenantId,
          user_id: userId,
          title,
          scheduled_at: date.toISOString(),
          notes: notes ?? null,
          status: "scheduled",
          created_by: userId,
        });
        if (error) return "Não consegui criar o agendamento agora. Peça pro cliente tentar de novo ou falar com a equipe.";
        return `Agendamento criado: "${title}" em ${date.toLocaleString("pt-BR")}.`;
      },
    }),

    list_appointments: tool({
      description:
        "Lista os agendamentos do membro. Por padrão retorna os próximos (futuros). Passe status='all' para incluir histórico.",
      inputSchema: z.object({
        status: z
          .enum(["upcoming", "all"])
          .optional()
          .describe("Filtro de agendamentos."),
      }),
      execute: async ({ status }) => {
        const upcoming = status !== "all";
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
      },
    }),

    list_rewards: tool({
      description:
        "Lista as recompensas disponíveis na loja, com custo em pontos e estoque.",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    list_documents: tool({
      description: "Lista os documentos do membro (laudos, receitas, termos).",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),

    list_care_plans: tool({
      description:
        "Lista os planos de acompanhamento/tratamento ativos do membro.",
      inputSchema: z.object({}),
      execute: async () => {
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
      },
    }),
  };
}
