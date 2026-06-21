"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TenantTabs({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = `/superadmin/tenants/${tenantId}`;
  const tabs = [
    { href: base, label: "Customização" },
    { href: `${base}/missions`, label: "Missões" },
    { href: `${base}/rewards`, label: "Loja" },
    { href: `${base}/plans`, label: "Planos" },
    { href: `${base}/clients`, label: "Clientes" },
    { href: `${base}/agenda`, label: "Agenda" },
    { href: `${base}/tratamentos`, label: "Tratamentos" },
    { href: `${base}/documentos`, label: "Documentos" },
    { href: `${base}/redemptions`, label: "Resgates" },
    { href: `${base}/validations`, label: "Validações" },
    { href: `${base}/profile-fields`, label: "Campos" },
    { href: `${base}/partnerships`, label: "Parcerias" },
    { href: `${base}/checkin`, label: "Check-in" },
  ];

  return (
    <nav className="flex gap-1 border-b border-black/5">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition",
              active
                ? "border-[var(--primary)] font-medium text-[var(--primary)]"
                : "border-transparent opacity-60 hover:opacity-100",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
