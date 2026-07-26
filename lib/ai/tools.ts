import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, documentPath } from "@/lib/storage";
import { textToPdf } from "@/lib/pdf";
import {
  createAppointmentValidado,
  proximasVagas,
  type OpcaoDeHorario,
} from "@/lib/appointments";
import {
  DEFAULT_TIMEZONE,
  formatarDataHora,
  formatarDataLonga,
  hojeNoFuso,
} from "@/lib/scheduling";

interface ToolContext {
  tenantId: string;
  userId: string;
  /** Fuso do negócio (tenant_settings.timezone) — base das datas oferecidas. */
  timeZone?: string;
}

// Uma vaga vira um token único que o modelo devolve inteiro na hora de marcar.
// Sem isso ele remonta provider_id/data/hora na mão e erra a combinação — o
// agendamento falha mesmo com a vaga existindo.
interface SlotDecodificado {
  p: string;
  c: string | null;
  d: string;
  t: string;
}

// Formato binário (44 chars) em vez de JSON em base64 (155): quanto mais
// curto o token, menor a chance de o modelo truncar ou "corrigir" o valor.
// 16 bytes do provider + 16 do procedimento (zeros = nenhum) + "AAAAMMDDHHMM".
const UUID_ZERO = "0".repeat(32);

function uuidParaBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesParaUuid(buf: Buffer): string {
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function encodeSlot(o: OpcaoDeHorario): string {
  return Buffer.concat([
    uuidParaBytes(o.providerId),
    uuidParaBytes(o.procedureId ?? UUID_ZERO),
    Buffer.from(o.dateISO.replace(/-/g, "") + o.time.replace(":", ""), "utf8"),
  ]).toString("base64url");
}

function decodeSlot(slotId: string): SlotDecodificado | null {
  try {
    const buf = Buffer.from(slotId, "base64url");
    if (buf.length !== 44) return null;

    const procedimento = buf.subarray(16, 32);
    const carimbo = buf.subarray(32).toString("utf8");
    const m = carimbo.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
    if (!m) return null;

    return {
      p: bytesParaUuid(buf.subarray(0, 16)),
      c: procedimento.every((b) => b === 0) ? null : bytesParaUuid(procedimento),
      d: `${m[1]}-${m[2]}-${m[3]}`,
      t: `${m[4]}:${m[5]}`,
    };
  } catch {
    // token inventado ou cortado pelo modelo — cai nos campos soltos
    return null;
  }
}

// Ferramentas do assistente — uma por consulta de dados do membro. `getAiTools`
// fecha sobre tenantId/userId da request atual (streamText não passa contexto
// arbitrário pro execute, só o input validado pelo schema).
export function getAiTools(ctx: ToolContext) {
  const db = createAdminClient();
  const { tenantId, userId, timeZone = DEFAULT_TIMEZONE } = ctx;

  const formatarOpcao = (o: OpcaoDeHorario) => ({
    slot_id: encodeSlot(o),
    data: formatarDataLonga(o.dateISO),
    date: o.dateISO,
    hora: o.time,
    profissional: o.providerName,
    provider_id: o.providerId,
    procedure_id: o.procedureId,
    duracao_min: o.duracao,
  });

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

    list_scheduling_catalog: tool({
      description:
        "Lista os procedimentos oferecidos (com duração) e os profissionais, dizendo quais procedimentos cada um atende. Use ANTES de falar de agendamento pra saber o que existe nesta clínica — nunca invente procedimento nem profissional.",
      inputSchema: z.object({}),
      execute: async () => {
        const [{ data: procedimentos }, { data: profissionais }, { data: vinculos }] =
          await Promise.all([
            db
              .from("procedures")
              .select("id, name, duration_min, description")
              .eq("tenant_id", tenantId)
              .eq("is_active", true)
              .order("display_order", { ascending: true }),
            db
              .from("providers")
              .select("id, name, specialty")
              .eq("tenant_id", tenantId)
              .eq("is_active", true)
              .order("display_order", { ascending: true }),
            db
              .from("provider_procedures")
              .select("provider_id, procedure_id")
              .eq("tenant_id", tenantId)
              .returns<{ provider_id: string; procedure_id: string }[]>(),
          ]);

        if (!profissionais?.length) {
          return "Esta clínica ainda não tem profissional cadastrado na agenda — não dá pra marcar por aqui. Oriente o cliente a falar com a equipe.";
        }

        return JSON.stringify({
          procedimentos: (procedimentos ?? []).map((p) => ({
            procedure_id: p.id,
            nome: p.name,
            duracao_min: p.duration_min,
            descricao: p.description,
          })),
          profissionais: profissionais.map((p) => {
            const meus = (vinculos ?? []).filter((v) => v.provider_id === p.id);
            return {
              provider_id: p.id,
              nome: p.name,
              especialidade: p.specialty,
              atende:
                meus.length === 0
                  ? "todos os procedimentos"
                  : meus.map((v) => v.procedure_id),
            };
          }),
        });
      },
    }),

    list_available_slots: tool({
      description:
        "Horários REAIS livres na agenda, já considerando o horário de trabalho do profissional, folgas e o que já está marcado. Use SEMPRE que o cliente quiser marcar: ofereça as opções retornadas pra ele escolher, em vez de perguntar que data ele prefere. Devolve no máximo 6 opções; se vier vazio, não há vaga no período — aumente days ou oriente a falar com a equipe.",
      inputSchema: z.object({
        procedure_id: z
          .string()
          .optional()
          .describe(
            "Id do procedimento (de list_scheduling_catalog). Define a duração do horário. Omita só se a clínica não tiver procedimentos cadastrados.",
          ),
        provider_id: z
          .string()
          .optional()
          .describe("Id do profissional, se o cliente já escolheu um."),
        from_date: z
          .string()
          .optional()
          .describe("Data inicial da busca, YYYY-MM-DD. Padrão: hoje."),
        days: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Quantos dias varrer a partir de from_date. Padrão: 14."),
      }),
      execute: async ({ procedure_id, provider_id, from_date, days }) => {
        const hoje = hojeNoFuso(timeZone);
        const opcoes = await proximasVagas(tenantId, {
          procedureId: procedure_id ?? null,
          providerId: provider_id ?? null,
          deISO: from_date && from_date >= hoje ? from_date : hoje,
          dias: days ?? 14,
          timeZone,
        });

        if (opcoes.length === 0) {
          return "Nenhum horário livre nesse período. Tente um período maior ou oriente o cliente a falar com a equipe.";
        }
        return JSON.stringify(opcoes.map(formatarOpcao));
      },
    }),

    request_appointment: tool({
      description:
        "Marca o agendamento DEPOIS que o cliente escolheu uma das opções devolvidas por list_available_slots. Passe o slot_id EXATO daquela opção, copiado sem alterar nada — não remonte data/hora/profissional na mão. O horário é validado de novo; se tiver sido ocupado nesse meio tempo, a ferramenta já devolve as próximas vagas pra você oferecer.",
      inputSchema: z.object({
        slot_id: z
          .string()
          .optional()
          .describe("Campo slot_id da opção escolhida em list_available_slots, copiado igual."),
        provider_id: z
          .string()
          .optional()
          .describe("Alternativa ao slot_id: id do profissional da opção escolhida."),
        date: z.string().optional().describe("Alternativa ao slot_id: data YYYY-MM-DD."),
        time: z.string().optional().describe("Alternativa ao slot_id: hora HH:MM em 24h."),
        procedure_id: z
          .string()
          .optional()
          .describe("Alternativa ao slot_id: id do procedimento."),
        title: z
          .string()
          .optional()
          .describe("Motivo, ex: 'Avaliação — dor de dente'. Padrão: nome do procedimento."),
        notes: z.string().optional().describe("Observações do cliente."),
      }),
      execute: async (args) => {
        const { slot_id, title, notes } = args;
        // O slot_id é o caminho preferido, mas modelo trunca token longo —
        // os campos soltos ficam como plano B em vez de virar erro seco.
        const slot =
          (slot_id ? decodeSlot(slot_id) : null) ??
          (args.provider_id && args.date && args.time
            ? {
                p: args.provider_id,
                c: args.procedure_id ?? null,
                d: args.date,
                t: args.time,
              }
            : null);

        if (!slot) {
          return "Faltou identificar a vaga. Chame list_available_slots e passe o slot_id da opção escolhida (ou provider_id + date + time dela).";
        }

        const formData = new FormData();
        formData.set("provider_id", slot.p);
        formData.set("date", slot.d);
        formData.set("time", slot.t);
        if (slot.c) formData.set("procedure_id", slot.c);
        if (title) formData.set("title", title);
        if (notes) formData.set("notes", notes);

        const { error } = await createAppointmentValidado(tenantId, formData, {
          timeZone,
          createdBy: userId,
          forcarUserId: userId,
        });

        if (error) {
          // Sem isso o modelo só sabe dizer "não consegui" — e some o motivo.
          console.error("[request_appointment] falhou", { tenantId, slot, error });
          const alternativas = await proximasVagas(tenantId, {
            procedureId: slot.c,
            deISO: slot.d,
            dias: 14,
            timeZone,
          });
          return JSON.stringify({
            erro: error,
            proximas_vagas: alternativas.map(formatarOpcao),
          });
        }

        return `Agendamento confirmado para ${formatarDataLonga(slot.d)} às ${slot.t}.`;
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
            // Sempre no fuso do negócio: o servidor roda em UTC e sem isso
            // um horário de 11:00 é mostrado como 14:00.
            data: formatarDataHora(a.scheduled_at, timeZone),
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
            data: formatarDataHora(d.created_at, timeZone),
          })),
        );
      },
    }),

    save_document: tool({
      description:
        "Gera o PDF e salva na área de Documentos do cliente um documento (atestado, contrato, termo, recibo...). Esta é a forma de ENTREGAR o documento ao cliente — chame-a com o texto final completo em vez de colar o documento inteiro na conversa. Passe o texto já preenchido, incluindo os placeholders [A PREENCHER] que sobraram. Só diga ao cliente que salvou depois que esta ferramenta confirmar.",
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

        try {
          const pdfBytes = await textToPdf(content);
          const { error: upErr } = await db.storage
            .from(BUCKETS.documents)
            .upload(path, pdfBytes, {
              contentType: "application/pdf",
              upsert: false,
            });
          if (upErr) {
            console.error("[save_document] upload", upErr);
            return "Não consegui salvar o documento agora.";
          }

          const { error } = await db.from("documents").insert({
            tenant_id: tenantId,
            user_id: userId,
            category,
            title: title.trim(),
            file_url: path,
            source: "ia",
          });
          if (error) {
            console.error("[save_document] insert", error);
            // Não deixa o arquivo órfão se a linha não entrou.
            await db.storage.from(BUCKETS.documents).remove([path]);
            return "Não consegui salvar o documento agora.";
          }

          return `Documento "${title}" salvo na aba Documentos do portal.`;
        } catch (err) {
          console.error("[save_document] throw", err);
          return "Não consegui salvar o documento agora.";
        }
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
