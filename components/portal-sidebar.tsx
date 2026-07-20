"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/use-theme";
import { Icon, type IconKey } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
}

interface PortalSidebarProps {
  brand: { name: string; subtitle: string; logoUrl: string | null };
  items: NavItem[];
  signOutAction: () => Promise<void>;
  defaultTheme: "light" | "dark";
}

export function PortalSidebar({ brand, items, signOutAction, defaultTheme }: PortalSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Preferência salva do cliente > tema padrão definido pelo dono do tenant.
  const [theme, toggleTheme] = useTheme("portal-theme", defaultTheme);

  // Path-based portal: /p/[slug]/... → detect base so links and isActive work correctly
  const pathMatch = pathname.match(/^(\/p\/[^/]+)/);
  const basePath = pathMatch?.[1] ?? "";

  const isActive = (href: string) => {
    const rel = basePath ? pathname.slice(basePath.length) || "/" : pathname;
    return href === "/" ? rel === "/" : rel.startsWith(href);
  };

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
        <Brand brand={brand} basePath={basePath} compact />
      </header>

      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-black/5 bg-white transition-transform dark:bg-white/[0.03]",
          "md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Brand brand={brand} basePath={basePath} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="rounded-lg p-1.5 hover:bg-black/5 md:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => {
            const active = isActive(item.href);
            const href = basePath + item.href;
            return (
              <Link
                key={item.href}
                href={href}
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

        <div className="border-t border-black/5 dark:border-white/5 p-3 space-y-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium opacity-70 transition hover:bg-black/5 dark:hover:bg-white/5 hover:opacity-100"
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>
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

function Brand({
  brand,
  basePath,
  compact,
}: {
  brand: PortalSidebarProps["brand"];
  basePath: string;
  compact?: boolean;
}) {
  return (
    <Link href={basePath + "/"} className="flex min-w-0 items-center gap-3">
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt={brand.name}
          className="h-9 w-9 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[var(--primary-foreground)]"
          style={{ background: "var(--primary)" }}
        >
          {brand.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight">{brand.name}</p>
        {!compact && (
          <p className="truncate text-[10px] uppercase tracking-wider opacity-50">
            {brand.subtitle}
          </p>
        )}
      </div>
    </Link>
  );
}
