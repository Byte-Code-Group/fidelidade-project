import { Icon } from "@/components/icons";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_SHORT,
  formatarMes,
  gradeDoMes,
  mesAnterior,
  mesSeguinte,
} from "@/lib/scheduling";

export interface DiaResumo {
  /** Quantos agendamentos ativos (não cancelados) no dia. */
  total: number;
  /** Cores dos profissionais que atendem no dia — pontinhos sob o número. */
  cores: string[];
  /** Dia fechado (folga/feriado do negócio inteiro). */
  fechado?: boolean;
}

// Calendário mensal navegável. Sem estado: mês e dia vivem na URL, então
// recarregar ou compartilhar o link cai no mesmo lugar.
export function MonthCalendar({
  mes,
  diaSelecionado,
  hoje,
  resumoPorDia,
  hrefDoDia,
  hrefDoMes,
}: {
  mes: string;
  diaSelecionado: string;
  hoje: string;
  resumoPorDia: Record<string, DiaResumo>;
  hrefDoDia: (dateISO: string) => string;
  hrefDoMes: (mes: string) => string;
}) {
  const dias = gradeDoMes(mes);
  const mesAtual = mes.slice(0, 7);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={hrefDoMes(mesAnterior(mesAtual))}
          aria-label="Mês anterior"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </Link>
        <p className="font-display text-[15px] font-semibold first-letter:uppercase">{formatarMes(mesAtual)}</p>
        <Link
          href={hrefDoMes(mesSeguinte(mesAtual))}
          aria-label="Próximo mês"
          className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-foreground"
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </Link>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-medium opacity-50">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const doMes = dia.slice(0, 7) === mesAtual;
          const resumo = resumoPorDia[dia];
          const selecionado = dia === diaSelecionado;

          return (
            <Link
              key={dia}
              href={hrefDoDia(dia)}
              aria-current={selecionado ? "date" : undefined}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition",
                doMes ? "" : "opacity-30",
                selecionado
                  ? "bg-[var(--primary)] font-semibold text-[var(--primary-foreground)]"
                  : "hover:bg-surface-2",
                !selecionado && dia === hoje && "ring-1 ring-[var(--primary)]",
                resumo?.fechado && !selecionado && "line-through opacity-40",
              )}
            >
              <span className="tabular-nums leading-none">{Number(dia.slice(8))}</span>

              {resumo && resumo.total > 0 && (
                <span className="flex items-center gap-0.5">
                  {resumo.cores.slice(0, 3).map((cor, i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: selecionado ? "currentColor" : cor }}
                    />
                  ))}
                  {resumo.total > 3 && (
                    <span className="text-[9px] leading-none opacity-70">
                      +{resumo.total - 3}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
