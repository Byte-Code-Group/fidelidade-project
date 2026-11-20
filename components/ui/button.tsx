"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_1px_2px_rgb(16_24_40/0.12),inset_0_1px_0_rgb(255_255_255/0.12)] hover:brightness-110",
  secondary:
    "bg-[var(--secondary)] text-white hover:brightness-110",
  outline:
    "border border-line bg-surface text-foreground hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]",
  ghost:
    "text-muted hover:bg-surface-2 hover:text-foreground",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Texto durante o envio (ex.: "Salvando…"). Sem isso, mantém o rótulo. */
  pendingLabel?: string;
}

// type="submit" ganha spinner e fica desabilitado enquanto a action do form
// roda — sem precisar de estado em cada tela. Ver useSubmitState.
export function Button({
  variant = "primary",
  className,
  pendingLabel,
  children,
  onClick,
  disabled,
  ...props
}: ButtonProps) {
  // pending do <form> pai: enquanto a action roda, os submits do form ficam
  // desabilitados (sem duplo envio) e mostram spinner.
  const { pending } = useFormStatus();
  const enviando = props.type === "submit" && pending;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition duration-200 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className,
      )}
      disabled={disabled || enviando}
      onClick={onClick}
      {...props}
    >
      {enviando && <Spinner className="mr-2" />}
      {enviando && pendingLabel ? pendingLabel : children}
    </button>
  );
}
