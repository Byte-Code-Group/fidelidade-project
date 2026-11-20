import { Icon, type IconKey } from "@/components/icons";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: IconKey;
}

// Cabeçalho padrão das telas: ícone da seção + título + ação principal à direita.
export function PageHeader({ title, subtitle, action, icon }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon name={icon} />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold md:text-[28px] md:leading-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
