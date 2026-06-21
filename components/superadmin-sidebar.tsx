"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon, type IconKey } from "@/components/icons";

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
];

export function SuperadminSidebar({
  signOutAction,
}: {
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <>
      {/* Topbar mobile */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/5 bg-[var(--background)]/90 px-4 py-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-1.5 hover:bg-black/5"
        >
          <Icon name="menu" />
        </button>
        <Brand />
      </header>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/5 bg-white transition-transform dark:bg-white/[0.03]",
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
            className="rounded-lg p-1.5 hover:bg-black/5 md:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <p className="px-6 pb-2 text-[10px] font-medium uppercase tracking-wider opacity-40">
          Plataforma
        </p>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "opacity-70 hover:bg-black/5 hover:opacity-100",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/5 p-3">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500 transition hover:bg-red-500/10"
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
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--primary-foreground)]"
        style={{ background: "var(--primary)" }}
      >
        <Icon name="grid" className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">
          Fideliza<span className="text-[var(--primary)]">.OS</span>
        </p>
        <p className="truncate text-[10px] uppercase tracking-wider opacity-50">
          Console do Operador
        </p>
      </div>
    </Link>
  );
}
