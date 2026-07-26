"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { formatTime24, isValidTime24, normalizeTime24 } from "@/lib/masks";

/**
 * Hora em 24h (HH:MM), sempre — <input type="time"> segue o idioma do
 * navegador e vira AM/PM em quem usa inglês, mesmo com lang="pt-BR" na página.
 *
 * O valor enviado no form é o mesmo "HH:MM" que o Postgres aceita em `time`,
 * então quem consome (ver lib/providers.ts) não muda.
 */
export function TimeInput({
  name,
  defaultValue = "",
  required,
  className,
  "aria-label": ariaLabel,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [valor, setValor] = useState(formatTime24(defaultValue));

  return (
    <Input
      name={name}
      value={valor}
      onChange={(e) => setValor(formatTime24(e.target.value))}
      // Fecha o que ficou pela metade: "8" vira 08:00 ao sair do campo.
      onBlur={() => setValor((atual) => normalizeTime24(atual) || atual)}
      required={required}
      inputMode="numeric"
      placeholder="00:00"
      maxLength={5}
      pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
      title="Hora no formato 24h, ex.: 14:30"
      aria-invalid={valor !== "" && !isValidTime24(valor)}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
