"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { Icon, type IconKey } from "@/components/icons";
import { Logo } from "@/components/logo";
import { motion } from "motion/react";

interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  exact?: boolean;
}

// Agrupado pelo que o dono está tentando fazer, não pela ordem em que as telas surgiram.
const GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/painel", label: "Dashboard", icon: "chart", exact: true },
      { href: "/painel/assistente", label: "Assistente IA", icon: "sparkles" },
    ],
  },
  {
    label: "Atendimento",
    items: [
      { href: "/painel/clientes", label: "Clientes", icon: "users" },
      { href: "/painel/agenda", label: "Agenda", icon: "calendar" },
      { href: "/painel/documentos", label: "Documentos", icon: "document" },
    ],
  },
  {
    label: "Programa de fidelidade",
    items: [
      { href: "/painel/missoes", label: "Missões", icon: "award" },
      { href: "/painel/validacoes", label: "Validações", icon: "checkCircle" },
      { href: "/painel/loja", label: "Loja", icon: "store" },
      { href: "/painel/resgates", label: "Resgates", icon: "gift" },
      { href: "/painel/planos", label: "Planos", icon: "receipt" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { href: "/painel/campanhas", label: "Campanhas", icon: "chat" },
      { href: "/painel/conexoes", label: "Conexões", icon: "link" },
    ],
  },
  {
    label: "Negócio",
    items: [
      { href: "/painel/customizacao", label: "Customização", icon: "template" },
      { href: "/painel/assinatura", label: "Assinatura", icon: "card" },
      { href: "/painel/seguranca", label: "Segurança", icon: "lock" },
    ],
  },
];

export interface OwnedTenantOption {
  id: string;
  name: string;
}

export function OwnerSidebar({
  signOutAction,
  businessName,
  tenants,
  activeTenantId,
  canCreateAnother,
  switchTenantAction,
}: {
  signOutAction: () => Promise<void>;
  businessName?: string;
  tenants?: OwnedTenantOption[];
  activeTenantId?: string;
  canCreateAnother?: boolean;
  switchTenantAction?: (tenantId: string) => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, toggleTheme] = useTheme("theme");

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/85 px-4 py-3 backdrop-blur-md md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 hover:bg-surface-2"
        >
          <Icon name="menu" />
        </button>
        <Brand businessName={businessName} />
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface transition-transform duration-300 ease-[var(--ease-out)]",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Brand businessName={businessName} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="px-3 pb-2">
          {tenants && tenants.length > 0 && switchTenantAction && (
            <TenantSwitcher
              tenants={tenants}
              activeTenantId={activeTenantId}
              canCreateAnother={canCreateAnother ?? true}
              switchTenantAction={switchTenantAction}
            />
          )}
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-1">
          {GROUPS.map((group, i) => (
            <div key={group.label ?? i}>
              {group.label && (
                <p className="px-3 pb-1.5 text-xs font-medium text-muted">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active ? "text-[var(--primary)]" : "text-muted hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="owner-nav-active"
                          className="absolute inset-0 rounded-xl bg-[var(--primary)]/10"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                        />
                      )}
                      <Icon name={item.icon} className="relative h-[18px] w-[18px]" />
                      <span className="relative">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-line p-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
            >
              <Icon name="logout" />
              Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

// Seletor de negócio — primeira opção do menu. Troca o tenant ativo do
// painel (cookie) ou leva pro fluxo de criar um negócio adicional
// (travado pelo plano — vide lib/tenant-limits.ts).
function TenantSwitcher({
  tenants,
  activeTenantId,
  canCreateAnother,
  switchTenantAction,
}: {
  tenants: OwnedTenantOption[];
  activeTenantId?: string;
  canCreateAnother: boolean;
  switchTenantAction: (tenantId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = tenants.find((t) => t.id === activeTenantId);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm font-medium transition hover:border-[var(--primary)]/30"
      >
        <Icon name="building" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">
          {active?.name ?? "Meu negócio"}
        </span>
        <Icon
          name="chevronRight"
          className={cn("h-3.5 w-3.5 shrink-0 opacity-50 transition", open && "rotate-90")}
        />
      </button>

      {open && (
        <div className="animate-rise absolute inset-x-0 top-full z-10 mt-1 space-y-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          {tenants.map((t) => (
            <form key={t.id} action={switchTenantAction.bind(null, t.id)}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm truncate transition",
                  t.id === activeTenantId
                    ? "bg-[var(--primary)]/10 text-[var(--primary)] font-medium"
                    : "opacity-75 hover:bg-surface-2 hover:opacity-100",
                )}
              >
                {t.id === activeTenantId && <Icon name="check" className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{t.name}</span>
              </button>
            </form>
          ))}

          <div className="my-1 border-t border-line" />

          {canCreateAnother ? (
            <Link
              href="/conta/configurar?mode=new"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)]/5"
            >
              <Icon name="plus" className="h-3.5 w-3.5 shrink-0" />
              Criar novo negócio
            </Link>
          ) : (
            <Link
              href="/painel/assinatura"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs opacity-60 hover:bg-surface-2"
            >
              <Icon name="crown" className="h-3.5 w-3.5 shrink-0" />
              Seu plano não permite mais negócios
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Brand({ businessName }: { businessName?: string }) {
  return (
    <Link href="/painel" className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
        <Logo className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">
          {businessName || (
            <>
              Fidelidade
            </>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          Painel do negócio
        </p>
      </div>
    </Link>
  );
}
