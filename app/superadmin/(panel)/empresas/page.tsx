import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";
import type { Tenant } from "@/lib/types";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";
const PAGE_SIZE = 10;

const statusStyle: Record<string, string> = {
  active: "bg-green-500/15 text-green-600",
  trial: "bg-amber-500/15 text-amber-600",
  suspended: "bg-red-500/15 text-red-600",
};

const statusLabel: Record<string, string> = {
  active: "Ativo",
  trial: "Trial",
  suspended: "Suspenso",
};

const FILTERS = [
  { key: "all", label: "Todas", match: () => true },
  { key: "active", label: "Ativas", match: (t: Tenant) => t.status === "active" },
  { key: "trial", label: "Em trial", match: (t: Tenant) => t.status === "trial" },
  { key: "suspended", label: "Vencidas", match: (t: Tenant) => t.status === "suspended" },
] as const;

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status = "all", page = "1" } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;
  const db = createAdminClient();

  const [{ data: tenants }, { data: members }] = await Promise.all([
    db
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<Tenant[]>(),
    db.from("memberships").select("tenant_id").returns<{ tenant_id: string }[]>(),
  ]);

  const all = tenants ?? [];
  const clientsByTenant = new Map<string, number>();
  for (const m of members ?? []) {
    clientsByTenant.set(m.tenant_id, (clientsByTenant.get(m.tenant_id) ?? 0) + 1);
  }

  const activeFilter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const filtered = all.filter(activeFilter.match);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const rows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle={`${all.length} tenants white-label cadastrados`}
        action={
          <Link href="/superadmin/tenants/new">
            <Button>
              <Icon name="plus" className="mr-2 h-4 w-4" /> Nova Empresa
            </Button>
          </Link>
        }
      />

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = all.filter(f.match).length;
          const active = f.key === activeFilter.key;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/superadmin/empresas" : `/superadmin/empresas?status=${f.key}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "border-black/10 opacity-70 hover:opacity-100",
              )}
            >
              {f.label} · {count}
            </Link>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider opacity-50">
                <th className="px-5 py-3 font-medium">Empresa</th>
                <th className="px-5 py-3 font-medium">Segmento</th>
                <th className="px-5 py-3 font-medium">Plano</th>
                <th className="px-5 py-3 text-right font-medium">Clientes</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-black/[0.02]">
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-[var(--primary-foreground)]"
                        style={{ background: "var(--primary)" }}
                      >
                        {t.name.charAt(0)}
                      </span>
                      <span className="font-medium hover:underline">{t.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 opacity-70">
                    {SEGMENT_TEMPLATES[t.segment_template]?.label ?? t.segment_template}
                  </td>
                  <td className="px-5 py-3.5 capitalize opacity-70">{t.saas_plan}</td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {clientsByTenant.get(t.id) ?? 0}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge className={statusStyle[t.status] ?? "bg-black/5"}>
                      {statusLabel[t.status] ?? t.status}
                    </Badge>
                    {t.status === "trial" && t.trial_ends_at && (
                      <p className="mt-0.5 text-xs opacity-50">
                        {new Date(t.trial_ends_at) < new Date()
                          ? "Expirado"
                          : `até ${new Date(t.trial_ends_at).toLocaleDateString("pt-BR")}`}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <a
                      href={
                        t.custom_domain
                          ? `https://${t.custom_domain}`
                          : `/p/${t.slug}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mr-3 opacity-50 hover:opacity-100"
                    >
                      Portal ↗
                    </a>
                    <Link
                      href={`/superadmin/tenants/${t.id}`}
                      className="text-[var(--primary)] hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center opacity-50">
                    Nenhuma empresa neste filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={
              status === "all"
                ? "/superadmin/empresas"
                : `/superadmin/empresas?status=${status}`
            }
          />
        </div>
      )}
    </div>
  );
}
