import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, documentPath } from "@/lib/storage";
import { textToPdf } from "@/lib/pdf";

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

    get_member_profile: tool({
      description:
        "Retorna os dados de cadastro do cliente: nome, e-mail e os campos de perfil configurados pelo negócio (CPF, telefone, data de nascimento, endereço etc. — variam por tenant). Use SEMPRE antes de gerar um documento pra preencher automaticamente o que já se sabe do cliente, em vez de perguntar de novo o que já está cadastrado.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: profile }, { data: fields }, { data: values }] = await Promise.all([
          db.from("users").select("full_name, email").eq("id", userId).maybeSingle(),
          db
            .from("profile_fields")
            .select("id, label, field_key")
            .eq("tenant_id", tenantId),
          db
            .from("profile_field_values")
            .select("field_id, value")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId),
        ]);

        const labelById = new Map((fields ?? []).map((f) => [f.id, f.label]));
        const valueByField = new Map((values ?? []).map((v) => [v.field_id, v.value]));
        const cadastro = (fields ?? []).reduce<Record<string, string>>((acc, f) => {
          const v = valueByField.get(f.id);
          if (v) acc[labelById.get(f.id) ?? f.field_key] = v;
          return acc;
        }, {});

        return JSON.stringify({
          nome: profile?.full_name ?? null,
          email: profile?.email ?? null,
          cadastro,
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
          .select("title, category, source, created_at")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!data?.length) return "Nenhum documento encontrado.";
        return JSON.stringify(
          data.map((d) => ({
            titulo: d.title,
            tipo: d.category,
            origem: d.source === "ia" ? "gerado por você" : "enviado pela equipe",
            data: new Date(d.created_at).toLocaleDateString("pt-BR"),
          })),
        );
      },
    }),

    save_document: tool({
      description:
        "Salva na área de Documentos do cliente um documento que você acabou de gerar (atestado, contrato, termo, recibo...). Chame SEMPRE depois de escrever o texto final, pra que ele não se perca quando a conversa fechar. Passe o texto completo e já preenchido, incluindo os placeholders [A PREENCHER] que sobraram.",
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .max(120)
          .describe("Título curto, ex: 'Atestado de comparecimento 19/07'."),
        category: z
          .enum(["documentos", "termos", "receituarios"])
          .describe(
            "termos = contrato/termo de consentimento; receituarios = receita/prescrição; documentos = qualquer outro.",
          ),
        content: z
          .string()
          .min(1)
          .max(20_000)
          .describe("Texto final e completo do documento, pronto pra imprimir."),
      }),
      execute: async ({ title, category, content }) => {
        const path = documentPath(tenantId, userId, "ia", "pdf");

        const pdfBytes = await textToPdf(content);
        const { error: upErr } = await db.storage
          .from(BUCKETS.documents)
          .upload(path, pdfBytes, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (upErr) return "Não consegui salvar o documento agora.";

        const { error } = await db.from("documents").insert({
          tenant_id: tenantId,
          user_id: userId,
          category,
          title: title.trim(),
          file_url: path,
          source: "ia",
        });
        if (error) {
          // Não deixa o arquivo órfão se a linha não entrou.
          await db.storage.from(BUCKETS.documents).remove([path]);
          return "Não consegui salvar o documento agora.";
        }

        return `Documento "${title}" salvo na aba Documentos do portal.`;
      },
    }),

    list_document_templates: tool({
      description:
        "Lista os modelos de documento (contrato, atestado, termo...) cadastrados pelo negócio, com o conteúdo de cada um. Use pra gerar um documento quando o cliente pedir — preencha as variáveis {{...}} do modelo com os dados da conversa e do membro, e responda com o texto final do documento preenchido.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await db
          .from("document_templates")
          .select("name, content")
          .eq("tenant_id", tenantId)
          .order("display_order", { ascending: true });

        if (!data?.length) return "Nenhum modelo de documento cadastrado.";
        return JSON.stringify(
          data.map((t) => ({ nome: t.name, conteudo: t.content })),
        );
      },
    }),

    remember_about_user: tool({
      description:
        "Atualiza a memória de longo prazo deste cliente — o que você lembra dele entre conversas diferentes (preferências, contexto recorrente, algo que ele pediu pra você lembrar, etc.). Use quando aprender algo que vale a pena lembrar da próxima vez que ele conversar com você. Você já recebe a memória atual no início da conversa: passe o texto COMPLETO já atualizado (mescle o que já existia com o que é novo), não só o que mudou. Mantenha curto — poucas linhas, uma por fato. Nunca guarde senha, dado de pagamento ou informação de saúde sensível.",
      inputSchema: z.object({
        content: z
          .string()
          .describe("Texto completo e atualizado da memória, uma linha por fato."),
      }),
      execute: async ({ content }) => {
        const trimmed = content.trim().slice(0, 2000);
        const { error } = await db
          .from("user_ai_memory")
          .upsert(
            { tenant_id: tenantId, user_id: userId, content: trimmed, updated_at: new Date().toISOString() },
            { onConflict: "tenant_id,user_id" },
          );
        if (error) return "Não consegui salvar a memória agora.";
        return "Memória atualizada.";
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
