"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export function CopyButton({ value, label = "Copiar link", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Link copiado.");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Não deu pra copiar. Selecione o link e copie manualmente.");
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-foreground active:scale-95",
        className,
      )}
    >
      <Icon name={copied ? "check" : "copy"} className={cn("h-3.5 w-3.5", copied && "text-emerald-500")} />
      {copied ? "Copiado" : label}
    </button>
  );
}
