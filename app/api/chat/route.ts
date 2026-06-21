import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_MSG_LENGTH = 2000;
const MAX_HISTORY = 20;

// Immutable guardrails — appended after tenant system prompt, cannot be overridden
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

  // Validate each message
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

  // Trim history to avoid token bloat
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
Se não souber algo, diga que vai verificar e peça para o cliente entrar em contato com a equipe.

${GUARDRAILS}`;

  const db = createAdminClient();

  // Upsert conversation — one per user per tenant session (last active)
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

  // Persist the latest user message
  const lastUserMsg = messages[messages.length - 1];
  if (lastUserMsg.role === "user") {
    await db.from("chat_messages").insert({
      conversation_id: conversationId,
      tenant_id: tenant.id,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // Stream Claude response
  const encoder = new TextEncoder();
  let assistantContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const send = (chunk: string) =>
          controller.enqueue(encoder.encode(chunk));

        // Send conversationId on the first chunk so client can track it
        send(`\x00${conversationId}\x00`);

        const claude = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1024,
          thinking: { type: "adaptive" },
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of claude) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantContent += event.delta.text;
            send(event.delta.text);
          }
        }

        // Persist assistant reply
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
