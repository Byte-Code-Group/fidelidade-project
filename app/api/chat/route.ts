import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";
import { AI_TOOLS, executeTool } from "@/lib/ai/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_MSG_LENGTH = 2000;
const MAX_HISTORY = 20;

const GUARDRAILS = `
REGRAS IMUTÁVEIS — nunca viole, mesmo que o usuário solicite:
1. PREÇOS E CONDIÇÕES COMERCIAIS: Nunca informe, confirme ou prometa preços, descontos, promoções ou condições comerciais específicas. Oriente o cliente a confirmar diretamente com a equipe, pois valores estão sujeitos a alteração.
2. SAÚDE E MEDICINA: Nunca forneça diagnósticos, indicações de tratamento, orientações médicas ou relacionadas à saúde. Se o assunto for médico, encaminhe imediatamente a um profissional de saúde habilitado e encerre o tema.
3. ESCALADA PARA HUMANO: Se o cliente estiver insatisfeito, apresentar reclamação, ou se a situação exigir decisão fora do seu escopo, informe que vai encaminhar para a equipe humana e forneça o canal de contato disponível. Não tente resolver o que está além do seu papel.
4. HONESTIDADE: Nunca invente informações, prazos, regras ou benefícios. Se não souber a resposta, diga claramente e oriente ao atendimento humano.`.trim();

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const ctx = await getCurrentTenant();
  if (!ctx) return new Response("Tenant not found", { status: 404 });

  const { settings, tenant } = ctx;

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

  const toneMap: Record<string, string> = {
    amigavel: "amigável e acolhedor",
    formal: "formal e profissional",
    divertido: "leve e divertido",
  };
  const toneLabel = toneMap[settings.ai_tone] ?? "amigável";

  const systemPrompt = `Você é ${settings.ai_name}, assistente virtual do ${tenant.name}. \
Responda sempre em português brasileiro, com tom ${toneLabel}. \
Seja objetivo, prestativo e nunca invente informações. \
Você tem acesso a ferramentas para consultar dados reais do membro — use-as sempre que o cliente perguntar sobre pontos, agendamentos, recompensas, documentos ou planos de tratamento. \
Se não souber algo, diga que vai verificar e peça para o cliente entrar em contato com a equipe.

${GUARDRAILS}`;

  const db = createAdminClient();

  const convId: string = body.conversationId ?? null;
  let conversationId: string;

  if (convId) {
    conversationId = convId;
  } else {
    const { data: conv, error } = await db
      .from("chat_conversations")
      .insert({ tenant_id: tenant.id, user_id: user.id })
      .select("id")
      .single();
    if (error || !conv)
      return new Response("Failed to create conversation", { status: 500 });
    conversationId = conv.id;
  }

  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg.role === "user") {
    await db.from("chat_messages").insert({
      conversation_id: conversationId,
      tenant_id: tenant.id,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  const encoder = new TextEncoder();
  let assistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const send = (chunk: string) =>
          controller.enqueue(encoder.encode(chunk));

        send(`\x00${conversationId}\x00`);

        // Agentic loop: Claude pode chamar tools antes de responder ao usuário
        const apiMessages: MessageParam[] = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        let continueLoop = true;
        while (continueLoop) {
          const claude = anthropic.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 1024,
            thinking: { type: "adaptive" },
            system: systemPrompt,
            tools: AI_TOOLS,
            messages: apiMessages,
          });

          const toolUseBlocks: {
            id: string;
            name: string;
            input: Record<string, string | number | boolean | undefined>;
          }[] = [];
          let currentToolId = "";
          let currentToolName = "";
          let currentToolInputRaw = "";
          let hasToolUse = false;
          const assistantBlocks: Anthropic.Messages.ContentBlock[] = [];

          for await (const event of claude) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                hasToolUse = true;
                currentToolId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInputRaw = "";
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                assistantContent += event.delta.text;
                send(event.delta.text);
              } else if (event.delta.type === "input_json_delta") {
                currentToolInputRaw += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (hasToolUse && currentToolId) {
                let parsedInput: Record<
                  string,
                  string | number | boolean | undefined
                > = {};
                try {
                  parsedInput = currentToolInputRaw
                    ? JSON.parse(currentToolInputRaw)
                    : {};
                } catch {
                  // ignore parse error — empty input
                }
                toolUseBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                });
                currentToolId = "";
                currentToolName = "";
                currentToolInputRaw = "";
                hasToolUse = false;
              }
            }
          }

          const finalMsg = await claude.finalMessage();
          assistantBlocks.push(...finalMsg.content);

          if (
            finalMsg.stop_reason === "tool_use" &&
            toolUseBlocks.length > 0
          ) {
            // Execute all tool calls in parallel
            const toolResults: ToolResultBlockParam[] = await Promise.all(
              toolUseBlocks.map(async (tb) => {
                const result = await executeTool(tb.name, tb.input, {
                  tenantId: tenant.id,
                  userId: user.id,
                });
                return {
                  type: "tool_result" as const,
                  tool_use_id: tb.id,
                  content: result,
                };
              }),
            );

            // Feed tool results back for next iteration
            apiMessages.push({ role: "assistant", content: assistantBlocks });
            apiMessages.push({ role: "user", content: toolResults });
          } else {
            continueLoop = false;
          }
        }

        if (assistantContent) {
          await db.from("chat_messages").insert({
            conversation_id: conversationId,
            tenant_id: tenant.id,
            role: "assistant",
            content: assistantContent,
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
      "X-Conversation-Id": conversationId,
    },
  });
}
