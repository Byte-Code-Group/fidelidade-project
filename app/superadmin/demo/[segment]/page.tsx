import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/superadmin";
import { TemplateDemo } from "@/components/template-demo";
import { getTemplate, SEGMENT_TEMPLATES } from "@/lib/segment-templates";

// Demo interativo de um template (não é o portal de nenhuma empresa). Mostra como
// o portal daquele template se comporta, com os defaults e dados de exemplo.
export default async function TemplateDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ segment: string }>;
  searchParams: Promise<{ page?: string; theme?: string }>;
}) {
  await requirePlatformAdmin();

  const { segment } = await params;
  const { page, theme } = await searchParams;
  if (!SEGMENT_TEMPLATES[segment]) notFound();
  const tpl = getTemplate(segment);
  const d = tpl.defaults;

  // Tema vem do ?theme= (override) ou do default do template.
  const activePage = page ?? "inicio";
  const themeMode: "light" | "dark" =
    theme === "light" || theme === "dark" ? theme : d.theme_mode;

  return (
    <div className="relative">
      {/* Barra fina indicando que é demo do template */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-amber-50 px-4 py-2 text-sm text-amber-700">
        <span>
          Demo do template <strong>{tpl.emoji} {tpl.label}</strong> · dados de
          exemplo, sem login
        </span>
        <div className="flex items-center gap-4">
          {/* Toggle claro/escuro */}
          <div className="flex items-center gap-1 rounded-lg border border-amber-300 p-0.5">
            <Link
              href={`/superadmin/demo/${segment}?page=${activePage}&theme=light`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                themeMode === "light" ? "bg-amber-500 text-white" : ""
              }`}
            >
              ☀️ Claro
            </Link>
            <Link
              href={`/superadmin/demo/${segment}?page=${activePage}&theme=dark`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                themeMode === "dark" ? "bg-amber-500 text-white" : ""
              }`}
            >
              🌙 Escuro
            </Link>
          </div>
          <Link
            href={`/superadmin/templates/${segment}`}
            className="font-medium underline underline-offset-2"
          >
            Voltar ao template
          </Link>
        </div>
      </div>

      <TemplateDemo
        active={activePage}
        config={{
          segmentLabel: tpl.label,
          emoji: tpl.emoji,
          primaryColor: d.primary_color,
          secondaryColor: d.secondary_color,
          themeMode,
          labelClient: tpl.label_client,
          labelAppointment: tpl.label_appointment,
          aiName: d.ai_name,
          aiWelcome: d.ai_welcome_message,
          rewardName: d.reward_name,
          loyaltyGoal: d.loyalty_goal,
          modules: Object.fromEntries(tpl.modules.map((m) => [m, true])),
          profileFields: (tpl.profileFields ?? []).map((f) => ({
            label: f.label,
            type: f.field_type,
          })),
        }}
      />
    </div>
  );
}
