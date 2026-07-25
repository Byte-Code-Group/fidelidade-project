"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes } from "react";

interface SubmitButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** Texto durante o envio (ex.: "Entrando…"). Sem isso, mantém o rótulo. */
  pendingLabel?: string;
}

// Botão de submit sem opinião de estilo — para as telas que têm visual próprio
// (login/cadastro da plataforma, landing) e não usam o <Button> do portal.
// Mesmo comportamento: spinner e desabilitado enquanto a action roda.
export function SubmitButton({
  className,
  pendingLabel,
  children,
  onClick,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending: enviando } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(
        "inline-flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:pointer-events-none",
        className,
      )}
      disabled={disabled || enviando}
      onClick={onClick}
      {...props}
    >
      {enviando && <Spinner />}
      {enviando && pendingLabel ? pendingLabel : children}
    </button>
  );
}
