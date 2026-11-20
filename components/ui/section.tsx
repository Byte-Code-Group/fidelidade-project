import type { ReactNode } from "react";

// Bloco padrão usado nas telas de configuração do painel (customização,
// dados do negócio etc) — mesmo container/header em todo lugar.
export function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
