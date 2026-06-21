import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { PortalPreview } from "@/components/portal-preview";
import { buildPortalNav, PORTAL_NAV } from "@/lib/portal-nav";
import { getTemplate, SEGMENT_TEMPLATES, MODULES } from "@/lib/segment-templates";

const freqLabel: Record<string, string> = {
  monthly: "mensal",
  weekly: "semanal",
  per_visit: "por visita",
};

export default async function TemplateShowcasePage({
  params,
}: {
  params: Promise<{ segment: string }>;
}) {
  const { segment } = await params;
  if (!SEGMENT_TEMPLATES[segment]) notFound();
  const tpl = getTemplate(segment);
  const d = tpl.defaults;

  // Todos os módulos do template ativos → é assim que o template "é".
  const enabledModules = Object.fromEntries(tpl.modules.map((m) => [m, true]));
  const nav = buildPortalNav(enabledModules);

  // Páginas: base (sempre) + opcionais do template.
  const moduleByKey = new Map(MODULES.map((m) => [m.key, m.label]));
  const basePages = PORTAL_NAV.filter((i) => !i.module).map((i) => i.label);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link
          href="/superadmin/templates"
          className="inline-flex items-center gap-1 text-sm opacity-60 hover:opacity-100"
        >
          <Icon name="chevronLeft" className="h-4 w-4" /> Voltar aos templates
        </Link>
        <a href={`/superadmin/demo/${segment}`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Icon name="arrowRight" className="mr-2 h-4 w-4" /> Testar template
          </Button>
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Padrões do template */}
        <div className="space-y-5">
          <Card>
            <CardContent className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-3xl dark:bg-white/10">
                {tpl.emoji}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{tpl.label}</h1>
                <p className="text-xs uppercase tracking-wider opacity-40">
                  template fixo · {segment}
                </p>
              </div>
              <div className="flex gap-1.5">
                <span
                  className="h-7 w-7 rounded-full border border-black/10"
                  style={{ background: d.primary_color }}
                  title="Cor primária"
                />
                <span
                  className="h-7 w-7 rounded-full border border-black/10"
                  style={{ background: d.secondary_color }}
                  title="Cor secundária"
                />
              </div>
            </CardContent>
          </Card>

          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            Template fixo. As empresas herdam estas páginas e defaults. Na empresa
            é possível <strong>remover páginas</strong> e personalizar marca,
            textos e logo — mas <strong>não adicionar</strong> páginas além das
            deste template.
          </p>

          {/* Páginas */}
          <Card>
            <CardContent className="space-y-3">
              <h2 className="font-semibold">Páginas do portal</h2>
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider opacity-50">
                  Sempre incluídas
                </p>
                <div className="flex flex-wrap gap-2">
                  {basePages.map((label) => (
                    <span
                      key={label}
                      className="rounded-lg bg-black/5 px-2.5 py-1 text-sm dark:bg-white/10"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider opacity-50">
                  Módulos deste template ({tpl.modules.length})
                </p>
                {tpl.modules.length === 0 ? (
                  <p className="text-sm opacity-50">
                    Nenhum módulo opcional — só as páginas base.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tpl.modules.map((key) => (
                      <Badge
                        key={key}
                        className="bg-[var(--primary)]/10 text-[var(--primary)]"
                      >
                        {moduleByKey.get(key) ?? key}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Defaults */}
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label="Rótulo do cliente" value={tpl.label_client} />
              <Info label="Rótulo do agendamento" value={tpl.label_appointment} />
              <Info label="Assistente IA" value={d.ai_name} />
              <Info
                label="Fidelidade"
                value={`Meta ${d.loyalty_goal} · ${freqLabel[d.loyalty_frequency]}`}
              />
              <Info label="Recompensa" value={d.reward_name} />
              <Info label="Tema" value={d.theme_mode === "dark" ? "Escuro" : "Claro"} />
              <div className="sm:col-span-2">
                <p className="text-xs opacity-50">Mensagem de boas-vindas da IA</p>
                <p className="text-sm italic opacity-80">
                  “{d.ai_welcome_message}”
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview "como é" */}
        <div>
          <p className="mb-3 text-xs font-medium uppercase tracking-wider opacity-50">
            Como o portal aparece
          </p>
          <div className="lg:sticky lg:top-6">
            <PortalPreview
              config={{
                tenantName: "Sua marca",
                logoUrl: null,
                primaryColor: d.primary_color,
                secondaryColor: d.secondary_color,
                themeMode: d.theme_mode,
                labelClient: tpl.label_client,
                rewardName: d.reward_name,
                nav,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs opacity-50">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
