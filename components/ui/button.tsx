"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90",
  secondary:
    "bg-[var(--secondary)] text-white hover:opacity-90",
  outline:
    "border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)]/5",
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
        "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
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
