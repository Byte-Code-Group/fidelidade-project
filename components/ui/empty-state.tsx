import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Sem card em volta — pra usar dentro de um card/seção que já existe. */
  bare?: boolean;
  className?: string;
}

// Estado vazio: ícone num halo da cor primária, título que diz o que falta e
// (opcional) a ação que resolve.
export function EmptyState({ icon, title, description, children, bare, className }: EmptyStateProps) {
  const body = (
    <div className={cn("animate-rise flex flex-col items-center text-center", bare ? "px-4 py-10" : "px-6 py-14")}>
      {icon && (
        <div className="relative mb-5">
          <div className="absolute inset-0 -m-3 rounded-full bg-[var(--primary)]/[0.07]" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/15 [&_svg]:h-6 [&_svg]:w-6">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
  if (bare) return <div className={className}>{body}</div>;
  return <Card className={cn("border-dashed bg-surface/60", className)}>{body}</Card>;
}
