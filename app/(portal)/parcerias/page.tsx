import { notFound, redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { Partnership } from "@/lib/types";

export default async function ParceriasPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: partnerships } = await supabase
    .from("partnerships")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .returns<Partnership[]>();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parcerias & Convênios"
        subtitle="Vantagens e descontos exclusivos para membros."
      />

      {!partnerships || partnerships.length === 0 ? (
        <EmptyState
          icon={<Icon name="gift" className="h-6 w-6" />}
          title="Nenhuma parceria por aqui ainda"
          description="Em breve você verá aqui os convênios e descontos com parceiros do programa."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partnerships.map((p) => (
            <div
              key={p.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-white/5"
            >
              {/* Logo / placeholder */}
              <div className="flex h-28 items-center justify-center bg-[var(--primary)]/5 px-6">
                {p.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logo_url}
                    alt={p.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    <Icon name="gift" className="h-7 w-7" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5 p-5">
                <h3 className="font-semibold">{p.name}</h3>

                {p.discount_text && (
                  <span className="inline-block w-fit rounded-full bg-[var(--secondary)]/10 px-3 py-0.5 text-xs font-medium text-[var(--secondary)]">
                    {p.discount_text}
                  </span>
                )}

                {p.description && (
                  <p className="text-sm opacity-60">{p.description}</p>
                )}

                {p.website_url && (
                  <a
                    href={p.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto pt-3 text-sm font-medium text-[var(--primary)] hover:underline"
                  >
                    Visitar site →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
