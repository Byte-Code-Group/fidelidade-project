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

// Botão flutuante do painel: o dono conversa com a IA, que acha clientes e gera documentos.
export function OwnerAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const setLast = (content: string) =>
    setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content }]);

  async function send() {
    const content = draft.trim();
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
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Assistente de IA"
          className="fixed inset-x-4 bottom-24 z-50 flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl sm:left-auto sm:right-6 sm:w-96 dark:border-white/10 dark:bg-[var(--background)]"
        >
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="sparkles" className="h-5 w-5 text-[var(--primary)]" /> Assistente
            </p>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                disabled={loading}
                className="text-xs opacity-60 hover:opacity-100 disabled:opacity-30"
              >
                Nova conversa
              </button>
            )}
          </div>

          <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
            {messages.length === 0 && (
              <p className="opacity-60">
                Peça um documento para um cliente, por exemplo: &ldquo;gera o contrato da Ana Paula&rdquo; ou
                &ldquo;atestado de 2 dias pro Bruno a partir de hoje&rdquo;.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2",
                    m.role === "user" ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-black/5 dark:bg-white/10",
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <ChatMarkdown text={m.content} />
                  ) : (
                    <span className="animate-pulse opacity-60">Pensando…</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2 border-t border-black/10 p-3 dark:border-white/10"
          >
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
              placeholder="Escreva sua mensagem…"
              aria-label="Mensagem"
              className="max-h-32 flex-1 resize-none rounded-xl border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] dark:border-white/15"
            />
            <button
              type="submit"
              aria-label="Enviar"
              disabled={!draft.trim() || loading}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] transition hover:opacity-90 disabled:opacity-40"
            >
              <Icon name="send" className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente de IA"}
        aria-expanded={open}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] shadow-lg transition hover:scale-105"
      >
        <Icon name={open ? "close" : "sparkles"} className="h-6 w-6" />
      </button>
    </>
  );
}
