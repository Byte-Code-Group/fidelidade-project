"use client";

import { useEffect, type ReactNode } from "react";

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <h2 className="text-[17px] font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md px-2 text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
