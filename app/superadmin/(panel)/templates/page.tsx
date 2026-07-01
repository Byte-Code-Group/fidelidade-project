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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider opacity-50">
                <th className="px-5 py-3 font-medium">Template</th>
                <th className="px-5 py-3 font-medium">Rótulo do Cliente</th>
                <th className="px-5 py-3 font-medium text-center">Módulos</th>
                <th className="px-5 py-3 text-right font-medium">Empresas</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {entries.map(([key, tpl]) => (
                <tr key={key} className="hover:bg-black/[0.02]">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/5 text-lg dark:bg-white/10">
                        {tpl.emoji}
                      </div>
                      <div>
                        <p className="font-medium">{tpl.label}</p>
                        <p className="text-xs uppercase tracking-wider opacity-40">
                          {key}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 opacity-70">{tpl.label_client}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="inline-block rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium dark:bg-white/10">
                      {tpl.modules.length}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-medium">
                    {countBySegment.get(key) ?? 0}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/superadmin/templates/${key}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline"
                    >
                      Ver <Icon name="arrowRight" className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
