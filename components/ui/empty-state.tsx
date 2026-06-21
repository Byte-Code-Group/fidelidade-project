import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

// Estado vazio centralizado, dentro de um card tracejado. Usado nas telas de
// módulos ainda sem dados (agendamentos, tratamentos, documentos...).
export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        {icon && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 opacity-60 dark:bg-white/10">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-sm opacity-60">{description}</p>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </Card>
  );
}
