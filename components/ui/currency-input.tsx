"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Input de dinheiro: digita só número (centavos), formata em tempo real
// como "20,00" e envia o valor real (ponto decimal) via input hidden.
export function CurrencyInput({
  name,
  defaultValue,
  className,
}: {
  name: string;
  defaultValue?: number;
  className?: string;
}) {
  const [cents, setCents] = useState(() => Math.round((defaultValue ?? 0) * 100));

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm transition focus-within:border-[var(--primary)] dark:border-white/10",
        className,
      )}
    >
      <span className="opacity-50">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={centsToBRL(cents)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          setCents(digits === "" ? 0 : parseInt(digits, 10));
        }}
        className="w-full min-w-0 bg-transparent outline-none"
      />
      <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
    </div>
  );
}
