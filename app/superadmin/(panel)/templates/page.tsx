import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";

export default async function TemplatesPage() {
  const db = createAdminClient();
  const { data: tenants } = await db
    .from("tenants")
    .select("segment_template")
    .returns<{ segment_template: string }[]>();

  const countBySegment = new Map<string, number>();
  for (const t of tenants ?? []) {
    countBySegment.set(
      t.segment_template,
      (countBySegment.get(t.segment_template) ?? 0) + 1,
    );
  }

  const entries = Object.entries(SEGMENT_TEMPLATES);

  return (
    <div>
      <PageHeader
        title="Templates de segmento"
        subtitle="Configure módulos e rótulos por tipo de negócio."
      />

      <p className="mb-6 max-w-2xl text-sm opacity-60">
        Cada template define os módulos, rótulos e regras de fidelidade de um
        segmento. As empresas herdam um template ao serem criadas e podem
        personalizá-lo depois.
      </p>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([key, tpl]) => (
          <Card key={key}>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/5 text-2xl dark:bg-white/10">
                  {tpl.emoji}
                </div>
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs opacity-70 dark:bg-white/10">
                  {countBySegment.get(key) ?? 0} empresas
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold">{tpl.label}</h3>
                <p className="text-xs uppercase tracking-wider opacity-40">{key}</p>
              </div>

              <div className="flex gap-6 text-sm">
                <div>
                  <p className="text-xs opacity-50">Cliente</p>
                  <p className="font-medium">{tpl.label_client}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Módulos</p>
                  <p className="font-medium">{tpl.modules.length}</p>
                </div>
              </div>

              <Link
                href={`/superadmin/templates/${key}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
              >
                Visualizar <Icon name="arrowRight" className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
