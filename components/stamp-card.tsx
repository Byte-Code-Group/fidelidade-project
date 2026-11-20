import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

const fmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });

// Os últimos 30 dias como a cartela de um cartão-fidelidade: cada dia é um
// selo, carimbado (e mais forte) conforme os check-ins daquele dia.
export function StampCard({ days }: { days: [string, number][] }) {
  const max = Math.max(1, ...days.map(([, n]) => n));
  const total = days.reduce((s, [, n]) => s + n, 0);
  const activeDays = days.filter(([, n]) => n > 0).length;

  return (
    <div>
      <div className="grid grid-cols-10 gap-2 sm:gap-2.5">
        {days.map(([day, n], i) => {
          const isToday = i === days.length - 1;
          const label = `${fmt.format(new Date(day + "T00:00:00Z"))}: ${n} check-in${n === 1 ? "" : "s"}`;
          return (
            <div
              key={day}
              title={label}
              aria-label={label}
              className={cn(
                "group relative aspect-square rounded-full",
                n === 0 && "border border-dashed border-line",
                isToday && "ring-2 ring-[var(--primary)]/40 ring-offset-2 ring-offset-surface",
              )}
            >
              {n > 0 && (
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] [animation:stamp_480ms_var(--ease-out)_both]"
                  style={{ opacity: 0.35 + 0.65 * (n / max), animationDelay: `${i * 22}ms` }}
                >
                  <Icon name="check" className="h-1/2 w-1/2" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>
          {total === 0
            ? "Nenhum selo ainda. O cliente carimba ao fazer check-in pelo portal."
            : `${total} check-in${total === 1 ? "" : "s"} em ${activeDays} dos últimos 30 dias`}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-line" /> sem check-in
          <span className="ml-2 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" /> com check-in
        </span>
      </div>
    </div>
  );
}
