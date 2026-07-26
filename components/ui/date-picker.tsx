"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_SHORT,
  formatarMes,
  gradeDoMes,
  hojeNoFuso,
  mesAnterior,
  mesSeguinte,
} from "@/lib/scheduling";

/**
 * Seletor de data no visual da plataforma. Substitui <input type="date">, que
 * o navegador desenha no idioma DELE ("July 2026", botão "Clear") e ignora o
 * lang da página.
 *
 * Escreve o valor num input hidden, então continua funcionando em form nativo
 * (name/required) além do par value/onChange.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  name,
  required,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (dateISO: string) => void;
  /** Datas anteriores ficam desabilitadas (YYYY-MM-DD). */
  min?: string;
  max?: string;
  name?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [mes, setMes] = useState(() => (value || hojeNoFuso()).slice(0, 7));
  const boxRef = useRef<HTMLDivElement>(null);

  // Abre sempre no mês da data escolhida, não onde o usuário parou de navegar.
  const alternar = () => {
    setAberto((v) => {
      if (!v) setMes((value || hojeNoFuso()).slice(0, 7));
      return !v;
    });
  };

  useEffect(() => {
    if (!aberto) return;

    const aoClicarFora = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const hoje = hojeNoFuso();
  const dias = gradeDoMes(mes);

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={value} required={required} />}

      <button
        type="button"
        onClick={alternar}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={ariaLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-left text-sm outline-none transition dark:border-white/10",
          aberto ? "border-[var(--primary)]" : "hover:border-[var(--primary)]/50",
        )}
      >
        <span className={cn(!value && "opacity-50")}>
          {value ? formatarDataCurta(value) : "Escolher data"}
        </span>
        <span aria-hidden className="opacity-40">
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="dialog"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-[17rem] rounded-2xl border border-black/10 bg-[var(--background)] p-3 shadow-lg dark:border-white/15"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMes(mesAnterior(mes))}
              className="rounded-lg px-2 py-1 text-sm opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              ←
            </button>
            <p className="text-sm font-semibold capitalize">{formatarMes(mes)}</p>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setMes(mesSeguinte(mes))}
              className="rounded-lg px-2 py-1 text-sm opacity-60 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
            >
              →
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium opacity-50">
            {WEEKDAY_SHORT.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {dias.map((dia) => {
              const doMes = dia.slice(0, 7) === mes;
              const bloqueado = (min && dia < min) || (max && dia > max);
              const selecionado = dia === value;

              return (
                <button
                  key={dia}
                  type="button"
                  disabled={Boolean(bloqueado)}
                  aria-current={selecionado ? "date" : undefined}
                  onClick={() => {
                    onChange(dia);
                    setAberto(false);
                  }}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg text-sm tabular-nums transition",
                    doMes ? "" : "opacity-30",
                    bloqueado && "cursor-not-allowed opacity-20 line-through",
                    selecionado
                      ? "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
                      : !bloqueado && "hover:bg-black/5 dark:hover:bg-white/10",
                    !selecionado && dia === hoje && "ring-1 ring-[var(--primary)]",
                  )}
                >
                  {Number(dia.slice(8))}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(hoje);
              setMes(hoje.slice(0, 7));
              setAberto(false);
            }}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/5"
          >
            Hoje
          </button>
        </div>
      )}
    </div>
  );
}

/** "2026-07-27" → "seg, 27 de julho de 2026". */
function formatarDataCurta(dateISO: string): string {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
