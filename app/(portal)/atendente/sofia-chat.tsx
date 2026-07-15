"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { ChatMarkdown } from "@/components/chat-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const QUICK_ACTIONS = ["Agendar", "Reagendar", "Receituário", "Documento"];

interface SofiaChatProps {
  aiName: string;
  welcome: string;
}

export function SofiaChat({ aiName, welcome }: SofiaChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    setDraft("");
    const history = messages.filter((m) => !m.streaming);
    const next: Message[] = [...history, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "", streaming: true }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content: c }) => ({ role, content: c })),
          conversationId,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let gotConvId = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // First chunk carries conversationId encoded as \x00<id>\x00<text?>
        if (!gotConvId && chunk.startsWith("\x00")) {
          const end = chunk.indexOf("\x00", 1);
          if (end !== -1) {
            const id = chunk.slice(1, end);
            setConversationId(id);
            gotConvId = true;
            accumulated += chunk.slice(end + 1);
          } else {
            accumulated += chunk;
          }
        } else {
          accumulated += chunk;
        }

        const text = accumulated;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: text,
            streaming: true,
          };
          return copy;
        });
      }

      // Mark streaming done
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: accumulated,
        };
        return copy;
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Desculpe, ocorreu um erro. Tente novamente.",
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-[72vh] flex-col overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-white/5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon name="sparkles" />
          </div>
          <div>
            <p className="font-semibold leading-tight">
              {aiName} — Atendente Virtual
            </p>
            <p className="text-xs opacity-50">Tire dúvidas e peça ajuda</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([]);
            setConversationId(null);
          }}
          className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
        >
          Nova Conversa
        </button>
      </div>

      {/* Thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-5 py-6">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon name="sparkles" className="h-9 w-9" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Olá! Eu sou a {aiName} 😊</h2>
            <p className="mt-2 max-w-md text-sm opacity-60">{welcome}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => {
                    setDraft(action);
                    inputRef.current?.focus();
                  }}
                  className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium opacity-80 transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                    m.role === "user"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-black/5 dark:bg-white/10",
                  )}
                >
                  {m.content ? (
                    m.role === "assistant" ? (
                      <ChatMarkdown text={m.content} />
                    ) : (
                      m.content
                    )
                  ) : (
                    <span className="inline-flex gap-1 opacity-60">
                      <span className="animate-bounce">•</span>
                      <span className="animate-bounce [animation-delay:0.15s]">•</span>
                      <span className="animate-bounce [animation-delay:0.3s]">•</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2 border-t border-black/5 px-4 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={loading}
          className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none transition focus:border-[var(--primary)] disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label="Enviar"
          disabled={!draft.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-40"
        >
          <Icon name="send" />
        </button>
      </form>
    </div>
  );
}
