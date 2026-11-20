"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/icons";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Janela modal simples (sem dependência externa). Fecha no Esc, no clique
 * fora e no botão. z-[60] porque as telas de conta usam `fixed inset-0 z-50`.
 */
export function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Trava o scroll do fundo enquanto o modal está aberto.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-surface text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <h2 className="text-[17px] font-semibold">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">{children}</div>

            <div className="border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-[var(--primary)] py-2.5 text-[14px] font-semibold text-[var(--primary-foreground)] transition hover:brightness-110 active:scale-[0.99]"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
