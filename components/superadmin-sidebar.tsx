"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { motion } from "motion/react";
import { Icon, type IconKey } from "@/components/icons";
import { Logo } from "@/components/logo";

interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: "/superadmin", label: "Dashboard", icon: "chart", exact: true },
  { href: "/superadmin/empresas", label: "Empresas", icon: "building" },
  { href: "/superadmin/templates", label: "Templates", icon: "template" },
  { href: "/superadmin/faturamento", label: "Faturamento", icon: "receipt" },
  { href: "/superadmin/relatorios", label: "Relatórios", icon: "activity" },
  { href: "/superadmin/seguranca", label: "Segurança", icon: "lock" },
];

export function SuperadminSidebar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
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
        <Brand />
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
          <Brand />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <p className="px-6 pb-1.5 text-xs font-medium text-muted">
          Plataforma
        </p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {ITEMS.map((item) => {
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
                    layoutId="admin-nav-active"
                    className="absolute inset-0 rounded-xl bg-[var(--primary)]/10"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                <Icon name={item.icon} className="relative h-[18px] w-[18px]" />
                <span className="relative">{item.label}</span>
              </Link>
            );
          })}
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

function Brand() {
  return (
    <Link href="/superadmin" className="flex min-w-0 items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] shadow-sm">
        <Logo className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">
          Fidelidade
        </p>
        <p className="truncate text-xs text-muted">
          Console do Operador
        </p>
      </div>
    </Link>
  );
}
