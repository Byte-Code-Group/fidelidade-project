"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { ChatMarkdown } from "@/components/chat-markdown";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGESTOES = [
  "Gera o contrato da Ana Paula",
  "Atestado de 2 dias pro Bruno a partir de hoje",
  "Quais documentos posso gerar?",
];

// Chat do painel (/painel/assistente): o dono conversa com a IA, que acha clientes e gera documentos.
export function OwnerAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const setLast = (content: string) =>
    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);

  async function send(texto = draft) {
    const content = texto.trim();
    if (!content || loading) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setDraft("");
    setLoading(true);
    try {
      const res = await fetch("/api/painel/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        setLast(text);
      }
      if (!text) setLast("Não consegui responder agora. Tente de novo.");
      router.refresh(); // documento gerado aparece na página do cliente sem recarregar
    } catch (err) {
      console.error(err);
      setLast("Desculpe, ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-surface md:h-[calc(100dvh-14rem)]">
      {messages.length > 0 && (
        <div className="flex justify-end border-b border-line px-4 py-2">
          <button
            type="button"
            onClick={() => setMessages([])}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
          >
            <Icon name="plus" className="h-3.5 w-3.5" /> Nova conversa
          </button>
        </div>
      )}

      <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-lg animate-rise flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon name="sparkles" className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">Como posso ajudar?</h2>
            <p className="mt-1 text-sm text-muted">
              Eu encontro clientes e gero documentos a partir dos seus modelos. Confirmo com você antes de gerar.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-line px-3 py-2 text-sm transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex animate-rise gap-3", m.role === "user" ? "justify-end" : "justify-start")}
              >
                {m.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Icon name="sparkles" className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    m.role === "user" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-surface-2",
                  )}
                >
                  {m.role === "user" ? (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  ) : m.content ? (
                    <ChatMarkdown text={m.content} />
                  ) : (
                    <span className="animate-pulse text-muted">Pensando…</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-line p-3 md:p-4"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-surface-2/50 p-2 transition focus-within:border-[var(--primary)]">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Escreva sua mensagem… (Shift+Enter quebra linha)"
            aria-label="Mensagem"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none [field-sizing:content]"
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!draft.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:opacity-90 active:scale-95 disabled:opacity-40"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
