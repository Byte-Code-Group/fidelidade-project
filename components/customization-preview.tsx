import type { CSSProperties } from "react";
import { Icon } from "@/components/icons";
import { MembershipCard } from "@/components/membership-card";
import { FieldWrapper, ProfileFieldInputs } from "@/components/profile-field-inputs";
import { Input } from "@/components/ui/input";
import { buildPortalNav } from "@/lib/portal-nav";
import type { Membership, ProfileField, Tenant, TenantSettings } from "@/lib/types";

const MEMBERSHIP: Membership = {
  id: "preview",
  tenant_id: "preview",
  user_id: "preview",
  plan_id: null,
  modality: "titular",
  status: "active",
  member_code: "0001",
  valid_until: null,
  points_total: 125,
  pending_plan_id: null,
  pending_plan_effective_at: null,
  created_at: "",
};

const PERIODO: Record<string, string> = { monthly: "meses", weekly: "semanas", per_visit: "visitas" };

// Miniatura do portal com os valores ainda não salvos. Mostra a parte que a
// aba aberta altera.
export function CustomizationPreview({
  tenantName,
  settings,
  view,
  profileFields = [],
}: {
  tenantName: string;
  settings: TenantSettings;
  view: string;
  profileFields?: ProfileField[];
}) {
  const dark = settings.theme_mode === "dark";
  const tenant = { name: tenantName } as Tenant;
  const goal = settings.loyalty_goal;

  return (
    <div
      data-theme={dark ? "dark" : undefined}
      className={`${dark ? "" : "force-light"} overflow-hidden rounded-3xl border border-line bg-background text-foreground`}
      style={
        {
          "--primary": settings.primary_color,
          "--secondary": settings.secondary_color,
          "--primary-foreground": "#ffffff",
        } as CSSProperties
      }
    >
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3">
        {settings.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)] text-sm font-bold text-white">
            {tenantName.charAt(0)}
          </span>
        )}
        <span className="truncate text-sm font-semibold">{tenantName}</span>
      </div>

      <div className="space-y-4 p-4">
        {view === "ia" ? (
          <div className="flex flex-col items-center px-2 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon name="sparkles" className="h-6 w-6" />
            </span>
            <p className="mt-4 max-w-full break-words text-lg font-semibold">{settings.ai_name}</p>
            <p className="mt-1 max-w-full break-words text-sm text-muted">
              {settings.ai_welcome_message ?? "Olá! Como posso ajudar?"}
            </p>
          </div>
        ) : view === "paginas" ? (
          <>
            <ul className="space-y-1">
              {buildPortalNav(settings.modules_enabled).map((item) => (
                <li key={item.href} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-muted">
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </li>
              ))}
            </ul>
            <p className="break-words border-t border-line pt-4 text-sm text-muted">
              Perfil de {settings.label_client || "Cliente"}. Próximo: {settings.label_appointment || "Agendamento"}.
            </p>
          </>
        ) : view === "cadastro" ? (
          // Mesmos campos e ordem de app/(portal)/perfil; inert: só demonstração.
          <div inert className="space-y-4">
            <p className="text-sm font-semibold">Dados do cadastro</p>
            <FieldWrapper label="Nome completo" required>
              <Input placeholder="Seu nome" />
            </FieldWrapper>
            <FieldWrapper label="E-mail">
              <Input defaultValue="cliente@email.com" disabled />
            </FieldWrapper>
            <FieldWrapper label="WhatsApp">
              <Input placeholder="(00) 00000-0000" />
            </FieldWrapper>
            <FieldWrapper label="Avisos no WhatsApp">
              <span className="flex items-start gap-2 text-sm">
                <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 shrink-0" />
                Quero receber novidades e lembretes de {tenantName} no WhatsApp.
              </span>
            </FieldWrapper>
            <ProfileFieldInputs fields={profileFields} values={new Map()} />
            <span className="block rounded-xl bg-[var(--primary)] py-2.5 text-center text-sm font-medium text-[var(--primary-foreground)]">
              Salvar alterações
            </span>
          </div>
        ) : (
          <>
            {view === "aparencia" && (
              <MembershipCard
                membership={MEMBERSHIP}
                memberName="Ana Souza"
                tenant={{ tenant, settings }}
              />
            )}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="break-words text-sm font-semibold">{settings.reward_name ?? "Programa Fidelidade"}</p>
              <p className="mt-1 text-xs text-muted">
                1 de {goal} {PERIODO[settings.loyalty_frequency]}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${100 / goal}%` }} />
              </div>
              <span className="mt-4 block rounded-xl bg-[var(--primary)] py-2.5 text-center text-sm font-medium text-[var(--primary-foreground)]">
                Fazer Check-in
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
