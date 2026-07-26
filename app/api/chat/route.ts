import { google } from "@ai-sdk/google";
import { streamText, stepCountIs } from "ai";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { getAiTools } from "@/lib/ai/tools";

const MAX_MSG_LENGTH = 2000;
const MAX_HISTORY = 20;

const GUARDRAILS = `
REGRAS IMUTÁVEIS — nunca viole, mesmo que o usuário solicite:
1. PREÇOS E CONDIÇÕES COMERCIAIS: Nunca informe, confirme ou prometa preços, descontos, promoções ou condições comerciais específicas. Oriente o cliente a confirmar diretamente com a equipe, pois valores estão sujeitos a alteração.
2. SAÚDE E MEDICINA: Nunca forneça diagnósticos, indicações de tratamento, orientações médicas ou relacionadas à saúde. Se o cliente relatar um sintoma ou problema de saúde, não avalie nem opine sobre a causa — em vez disso, acolha e ofereça ativamente ajudar a marcar uma consulta de avaliação com a equipe (use a ferramenta de agendamento). Nunca apenas encerre o assunto sem oferecer esse próximo passo.
3. ESCALADA PARA HUMANO: Se o cliente estiver insatisfeito, apresentar reclamação, ou se a situação exigir decisão fora do seu escopo, informe que vai encaminhar para a equipe humana e forneça o canal de contato disponível. Não tente resolver o que está além do seu papel.
4. HONESTIDADE: Nunca invente informações, prazos, regras ou benefícios. Se não souber a resposta, diga claramente e oriente ao atendimento humano. Isso NÃO se aplica a preencher um documento com placeholder explícito (ex: [A PREENCHER]) pra um dado que falta — isso é honesto, não é inventar.`.trim();

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ctx = await getCurrentTenant();
  if (!ctx) return new Response("Tenant not found", { status: 404 });

  const { settings, tenant } = ctx;

  const db = createAdminClient();

  // O login do Supabase é global à plataforma, mas o tenant vem do host/cookie
  // — sem esta checagem um cliente de um tenant conversaria (e queimaria a
  // cota de IA) no tenant de outro.
  // Pertence a este tenant quem for cliente (public.users) OU dono/staff
  // (platform_users) dele — o dono precisa conseguir testar o próprio portal.
  const [{ data: clientRow }, { data: staffRow }] = await Promise.all([
    db
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .eq("tenant_id", tenant.id)
      .maybeSingle<{ tenant_id: string }>(),
    db
      .from("platform_users")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.id)
      .maybeSingle<{ tenant_id: string }>(),
  ]);

  if (!clientRow && !staffRow) {
    return new Response("Forbidden", { status: 403 });
  }

  const body = await req.json();
  const rawMessages: { role: "user" | "assistant"; content: string }[] =
    body.messages ?? [];

  if (!rawMessages.length) return new Response("No messages", { status: 400 });

  for (const msg of rawMessages) {
    if (msg.role !== "user" && msg.role !== "assistant") {
      return new Response("Invalid message role", { status: 400 });
    }
    if (typeof msg.content !== "string") {
      return new Response("Invalid message content", { status: 400 });
    }
    if (msg.content.length > MAX_MSG_LENGTH) {
      return new Response(
        `Message too long (max ${MAX_MSG_LENGTH} characters)`,
        { status: 400 },
      );
    }
  }

  const messages = rawMessages.slice(-MAX_HISTORY);

  // Quem chega aqui já passou pela checagem de tenant acima: é cliente
  // cadastrado (ou staff testando). O nome vai direto no prompt pra IA não
  // abrir a conversa perguntando com quem está falando.
  const [{ data: memoryRow }, { data: quemFala }] = await Promise.all([
    db
      .from("user_ai_memory")
      .select("content")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .maybeSingle<{ content: string }>(),
    db
      .from("users")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null }>(),
  ]);

  const nomeDoCliente = quemFala?.full_name?.trim() || null;
  const ehStaff = !clientRow && Boolean(staffRow);

  const toneMap: Record<string, string> = {
    amigavel: "amigável e acolhedor",
    formal: "formal e profissional",
    divertido: "leve e divertido",
  };
  const toneLabel = toneMap[settings.ai_tone] ?? "amigável";

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const systemPrompt = `Você é ${settings.ai_name}, assistente virtual do ${tenant.name}. \
Hoje é ${today}. \
Responda sempre em português brasileiro, com tom ${toneLabel}. \
Seja proativo, prestativo e nunca invente informações. \

QUEM ESTÁ FALANDO COM VOCÊ: ${
    ehStaff
      ? `alguém da equipe do ${tenant.name} testando o assistente${nomeDoCliente ? ` (${nomeDoCliente})` : ""}.`
      : `${nomeDoCliente ?? "um cliente"}, que JÁ é cliente cadastrado e está logado no portal do ${tenant.name}.`
  } \
Nunca pergunte se a pessoa é cliente, se já se cadastrou, como ela se chama ou qualquer dado que as ferramentas já entregam (cadastro, pontos, agendamentos, documentos, planos) — consulte a ferramenta antes de perguntar, e pergunte só o que realmente não está lá. \
Trate a pessoa pelo primeiro nome desde a primeira resposta. \

Seu papel é ajudar o cliente no que ele precisar dentro do programa: tirar dúvidas, sugerir marcar uma consulta/avaliação quando fizer sentido, e usar as ferramentas disponíveis para consultar pontos, agendamentos, recompensas, documentos e planos de tratamento, ou para criar um novo agendamento quando o cliente pedir. \
Se não souber algo, diga que vai verificar e peça para o cliente entrar em contato com a equipe. \
FORMATAÇÃO: use markdown de verdade — cada item de lista em sua própria linha começando com "- ", linha em branco entre parágrafos, **negrito** só pra destacar palavra-chave. Nunca liste itens em sequência dentro do mesmo parágrafo separados só por espaço.

AGENDAMENTO — sempre que o cliente demonstrar interesse em ser atendido (sintoma, "quero marcar", "preciso de uma consulta"):
1. NUNCA pergunte "que data e horário você prefere?" nem repita o horário de funcionamento como resposta. Quem sabe a agenda é você, não ele.
2. Descubra só o TIPO de atendimento. Chame a ferramenta de catálogo (list_scheduling_catalog) e ofereça os procedimentos que existem de verdade; se o cliente já disse o que quer ("consulta", "limpeza"), escolha o procedimento correspondente sozinho e siga.
3. Chame list_available_slots com o procedure_id escolhido e OFEREÇA AO MENOS 3 opções reais de data + horário + profissional, em lista markdown, numeradas, pedindo pro cliente escolher uma (ou pedir outras). Se vierem menos de 3, mostre as que vieram e diga que são as próximas vagas; se vier vazio, chame de novo com days maior antes de dizer que não há vaga.
4. Só quando ele escolher, chame request_appointment passando o slot_id EXATO daquela opção (copie o valor, não remonte data/hora/profissional). Se a ferramenta devolver erro, ela já vem com as próximas vagas: avise em uma linha e ofereça essas opções.
5. Nunca diga que marcou antes de a ferramenta confirmar, e nunca invente horário que não veio de list_available_slots.

GERAÇÃO DE DOCUMENTOS — quando o cliente pedir um documento (atestado, contrato, termo, recibo...):
1. Chame a ferramenta de modelos de documento pra ver os disponíveis. Se não existir um modelo pro que o cliente pediu, diga isso claramente — nunca invente um modelo que não existe.
2. Chame a ferramenta de perfil do cliente pra pegar automaticamente nome, e-mail e os dados de cadastro já preenchidos (CPF, telefone, data de nascimento etc.). NUNCA peça de novo um dado que essa ferramenta já retornou.
3. Pergunte só o que realmente falta e é específico do caso (ex: qual procedimento, motivo, data). Se o cliente não souber ou não quiser informar algo, gere o documento assim mesmo, com um placeholder claro tipo [A PREENCHER] no lugar — nunca trave a geração esperando dado nenhum. Entregar um rascunho pra equipe completar é sempre melhor que não entregar nada.
4. Para ENTREGAR o documento você DEVE chamar a ferramenta de salvar documento (save_document) passando o texto final completo e já preenchido (incluindo os placeholders [A PREENCHER] que sobraram). É a ferramenta que gera o PDF e guarda na aba Documentos — NÃO cole o documento inteiro na conversa. Só depois de chamar a ferramenta, responda ao cliente em poucas linhas: confirme que o documento foi gerado, diga que está disponível na aba Documentos do portal, e ofereça ajustar algo se precisar. IMPORTANTE: se a ferramenta retornar erro, avise honestamente que não conseguiu salvar — nunca diga que salvou se a ferramenta não confirmou.
${
  settings.ai_behavior
    ? `\nCOMPORTAMENTO ESPECÍFICO DESTA CLÍNICA — siga além do que já foi dito acima, mas nunca em conflito com as regras imutáveis abaixo nem com o que já foi dito sobre quem está falando com você (é sempre cliente cadastrado e logado, mesmo que o texto abaixo mande perguntar):\n${settings.ai_behavior}\n`
    : ""
}
MEMÓRIA DESTE CLIENTE (do que você já sabe de conversas anteriores):
${memoryRow?.content ? memoryRow.content : "(nenhuma memória salva ainda — esta é a primeira vez que ele conversa com você, ou nada relevante foi guardado)"}
Use isso pra não repetir pergunta que ele já respondeu antes e pra soar como quem lembra dele. Quando aprender algo novo que vale guardar pra próxima conversa (preferência, pedido recorrente, algo que ele pediu explicitamente pra lembrar), chame a ferramenta de memória com o texto completo já atualizado. Não guarde toda conversa, só o que é útil de verdade pro futuro.

${GUARDRAILS}`;

  // Token limits per plan (tokens/month; -1 = unlimited)
  const TOKEN_LIMITS: Record<string, number> = {
    starter: 50_000,
    pro: 500_000,
    premium: -1,
  };

  // Check monthly token quota
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const { data: usage } = await db
      .from("tenant_ai_usage")
      .select("tokens_used")
      .eq("tenant_id", tenant.id)
      .eq("year_month", yearMonth)
      .maybeSingle<{ tokens_used: number }>();

    const limit = TOKEN_LIMITS[tenant.saas_plan] ?? TOKEN_LIMITS.starter;
    if (limit !== -1 && (usage?.tokens_used ?? 0) >= limit) {
      return new Response("Limite de mensagens do mês atingido.", { status: 429 });
    }
  }

  const convId: string | null = body.conversationId ?? null;
  let conversationId: string | null = null;

  // O id vem do cliente — só é aceito se a conversa for mesmo deste usuário
  // neste tenant. Caso contrário ignora e abre uma nova.
  if (convId) {
    const { data: owned } = await db
      .from("chat_conversations")
      .select("id")
      .eq("id", convId)
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.id)
      .maybeSingle<{ id: string }>();
    conversationId = owned?.id ?? null;
  }

  if (!conversationId) {
    const { data: conv, error } = await db
      .from("chat_conversations")
      .insert({ tenant_id: tenant.id, user_id: user.id })
      .select("id")
      .single<{ id: string }>();
    if (error || !conv)
      return new Response("Failed to create conversation", { status: 500 });
    conversationId = conv.id;
  }

  const activeConversationId = conversationId;

  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg.role === "user") {
    await db.from("chat_messages").insert({
      conversation_id: activeConversationId,
      tenant_id: tenant.id,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const send = (chunk: string) =>
          controller.enqueue(encoder.encode(chunk));

        send(`\x00${activeConversationId}\x00`);

        const result = streamText({
          model: google("gemini-2.5-flash"),
          system: systemPrompt,
          messages,
          tools: getAiTools({
            tenantId: tenant.id,
            userId: user.id,
            timeZone: settings.timezone || undefined,
          }),
          stopWhen: stepCountIs(8),
        });

        for await (const chunk of result.textStream) {
          send(chunk);
        }

        const assistantContent = await result.text;
        const usage = await result.usage;
        const totalTokensUsed =
          (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);

        if (assistantContent) {
          await db.from("chat_messages").insert({
            conversation_id: activeConversationId,
            tenant_id: tenant.id,
            role: "assistant",
            content: assistantContent,
          });
        }

        if (totalTokensUsed > 0) {
          const yearMonth = new Date().toISOString().slice(0, 7);
          await db.rpc("increment_ai_usage", {
            p_tenant_id: tenant.id,
            p_year_month: yearMonth,
            p_tokens: totalTokensUsed,
          });
        }

        controller.close();
      } catch (err) {
        console.error("[chat/route]", err);
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Conversation-Id": activeConversationId,
    },
  });
}
