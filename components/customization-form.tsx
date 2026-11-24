"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Section, Field } from "@/components/ui/section";
import { Icon, type IconKey } from "@/components/icons";
import { AiBehaviorField } from "@/components/ai-behavior-field";
import { LogoUploadForm } from "@/components/logo-upload-form";
import { CustomizationPreview } from "@/components/customization-preview";
import { ProfileFieldsList } from "@/components/profile-fields-list";
import { cn } from "@/lib/utils";
import type { ProfileField, TenantSettings } from "@/lib/types";

interface CustomizationFormProps {
  tenantName: string;
  templateLabel: string;
  templateHref?: string;
  portalUrl: string;
  settings: TenantSettings;
  allowedModules: { key: string; label: string }[];
  saveAction: (formData: FormData) => void;
  uploadAction: (formData: FormData) => void;
  /** Form próprio dos dados do negócio (só no painel do dono). */
  businessPanel?: ReactNode;
  profileFields?: ProfileField[];
  createProfileFieldAction?: (formData: FormData) => Promise<{ error?: string }>;
  updateProfileFieldAction?: (fieldId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteProfileFieldAction?: (fieldId: string) => Promise<{ error?: string }>;
  reorderProfileFieldsAction?: (orderedIds: string[]) => Promise<{ error?: string }>;
}

type Values = Record<string, string>;

const FORM_TABS = ["aparencia", "paginas", "fidelidade", "ia", "contato"];
const PREVIEW_TABS = ["aparencia", "paginas", "fidelidade", "ia", "cadastro"];

const PALETTES = [
  { name: "Azul", primary: "#2563eb", secondary: "#1e40af" },
  { name: "Turquesa", primary: "#0f766e", secondary: "#134e4a" },
  { name: "Verde", primary: "#15803d", secondary: "#14532d" },
  { name: "Vinho", primary: "#be123c", secondary: "#881337" },
  { name: "Roxo", primary: "#7c3aed", secondary: "#4c1d95" },
  { name: "Grafite", primary: "#475569", secondary: "#1e293b" },
];

function readValues(form: HTMLFormElement): Values {
  return Object.fromEntries(
    [...new FormData(form)].map(([k, v]) => [k, String(v)]),
  );
}

const sameValues = (a: Values, b: Values) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => a[k] === b[k]);
};

// Os campos são nativos; a cada mudança o form inteiro é lido para alimentar a
// prévia e o aviso de alterações não salvas.
export function CustomizationForm({
  tenantName,
  templateLabel,
  templateHref,
  portalUrl,
  settings,
  allowedModules,
  saveAction,
  uploadAction,
  businessPanel,
  profileFields,
  createProfileFieldAction,
  updateProfileFieldAction,
  deleteProfileFieldAction,
  reorderProfileFieldsAction,
}: CustomizationFormProps) {
  const modules = settings.modules_enabled ?? {};
  const [active, setActive] = useState("aparencia");
  const [values, setValues] = useState<Values | null>(null);
  const [baseline, setBaseline] = useState<Values | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [saving, startSaving] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<Values | null>(null);

  // Ponto de partida: na montagem e depois de "Descartar" (campos remontados).
  useEffect(() => {
    const initial = readValues(formRef.current!);
    setBaseline(initial);
    setValues(initial);
  }, [resetKey]);

  // Só o que foi enviado vira "salvo": edições feitas durante o envio continuam
  // pendentes, e um erro (settings não muda) não apaga o aviso.
  const savedKey = JSON.stringify({ ...settings, logo_url: null });
  useEffect(() => {
    if (!submitted.current) return;
    setBaseline(submitted.current);
    submitted.current = null;
  }, [savedKey]);

  const dirty = !!values && !!baseline && !sameValues(values, baseline);

  // No próximo tick: os botões de modelo/paleta mudam o campo via estado.
  const refresh = () =>
    setTimeout(() => formRef.current && setValues(readValues(formRef.current)));

  const hasProfileFieldsActions =
    createProfileFieldAction &&
    updateProfileFieldAction &&
    deleteProfileFieldAction &&
    reorderProfileFieldsAction;

  const tabs: { key: string; label: string; icon: IconKey }[] = [
    { key: "aparencia", label: "Aparência", icon: "sparkles" },
    { key: "paginas", label: "Páginas", icon: "grid" },
    { key: "fidelidade", label: "Fidelidade", icon: "award" },
    { key: "ia", label: "Assistente", icon: "chat" },
    { key: "contato", label: "Contato", icon: "mapPin" },
    ...(hasProfileFieldsActions
      ? [{ key: "cadastro", label: "Cadastro", icon: "users" as const }]
      : []),
    ...(businessPanel
      ? [{ key: "negocio", label: "Negócio", icon: "building" as const }]
      : []),
  ];

  const live = values ?? {};
  const liveSettings: TenantSettings = values
    ? {
        ...settings,
        primary_color: live.primary_color,
        secondary_color: live.secondary_color,
        theme_mode: live.theme_mode === "dark" ? "dark" : "light",
        label_client: live.label_client,
        label_appointment: live.label_appointment,
        ai_name: live.ai_name,
        ai_welcome_message: live.ai_welcome_message || null,
        loyalty_goal: Number(live.loyalty_goal) || 1,
        loyalty_frequency: live.loyalty_frequency,
        reward_name: live.reward_name || null,
        modules_enabled: Object.fromEntries(
          allowedModules.map((m) => [m.key, live[`module_${m.key}`] === "on"]),
        ),
      }
    : settings;

  const panels: Record<string, ReactNode> = {
    aparencia: (
      <>
        <Section title="Logo" desc="Aparece no topo do portal e na aba do navegador. É salva assim que você envia.">
          <LogoUploadForm
            uploadAction={uploadAction}
            logoUrl={settings.logo_url}
            fallbackLabel={tenantName}
            fallbackColor={liveSettings.primary_color}
          />
        </Section>
        <Section title="Cores" desc="Escolha uma combinação pronta ou defina as suas.">
          <BrandColors primary={settings.primary_color} secondary={settings.secondary_color} />
        </Section>
        <Section title="Tema inicial" desc="Cada cliente pode alternar entre claro e escuro no portal.">
          <div role="radiogroup" aria-label="Tema inicial" className="grid grid-cols-2 gap-3">
            <ThemeOption value="light" label="Claro" icon="sun" current={settings.theme_mode} />
            <ThemeOption value="dark" label="Escuro" icon="moon" current={settings.theme_mode} />
          </div>
        </Section>
      </>
    ),

    paginas: (
      <>
        <Section
          title="Páginas do portal"
          desc={`Escolha o que o cliente vê no menu. Opções do modelo ${templateLabel}.`}
          action={
            templateHref && (
              <Link href={templateHref} className="text-sm text-[var(--primary)] hover:underline">
                Ver template
              </Link>
            )
          }
        >
          {allowedModules.length === 0 ? (
            <p className="text-sm text-muted">Este modelo só tem as páginas básicas.</p>
          ) : (
            <div className="divide-y divide-line">
              {allowedModules.map((m) => (
                <Toggle
                  key={m.key}
                  name={`module_${m.key}`}
                  label={m.label}
                  defaultChecked={modules[m.key] === true}
                />
              ))}
            </div>
          )}
        </Section>
        <Section title="Nomes usados no portal" desc="Use as palavras do seu negócio, como paciente ou aluno.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Como chamar o cliente">
              <Input name="label_client" defaultValue={settings.label_client} />
            </Field>
            <Field label="Como chamar o agendamento">
              <Input name="label_appointment" defaultValue={settings.label_appointment} />
            </Field>
          </div>
        </Section>
      </>
    ),

    fidelidade: (
      <>
        <Section title="Regras" desc="Quanto o cliente precisa frequentar para ganhar a recompensa.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta">
              <Input name="loyalty_goal" type="number" min={1} required defaultValue={settings.loyalty_goal} />
            </Field>
            <Field label="Frequência">
              <Select name="loyalty_frequency" defaultValue={settings.loyalty_frequency}>
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
                <option value="per_visit">Por visita</option>
              </Select>
            </Field>
            <Field label="Pontos por visita">
              <Input
                name="loyalty_points_per_checkin"
                type="number"
                min={1}
                required
                defaultValue={settings.loyalty_points_per_checkin}
              />
            </Field>
          </div>
          <Toggle
            name="loyalty_streak_reset"
            label="Zerar progresso ao falhar um período"
            defaultChecked={settings.loyalty_streak_reset}
          />
        </Section>
        <Section title="Recompensa" desc="O que o cliente ganha ao bater a meta.">
          <Field label="Nome">
            <Input name="reward_name" defaultValue={settings.reward_name ?? ""} />
          </Field>
          <Field label="Descrição">
            <Input name="reward_description" defaultValue={settings.reward_description ?? ""} />
          </Field>
        </Section>
      </>
    ),

    ia: (
      <>
        <Section title="Identidade" desc="Como o assistente se apresenta ao cliente.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input name="ai_name" defaultValue={settings.ai_name} />
            </Field>
            <Field label="Tom">
              <Select name="ai_tone" defaultValue={settings.ai_tone}>
                <option value="amigavel">Amigável</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </Select>
            </Field>
          </div>
          <Field label="Mensagem de boas-vindas">
            <Input name="ai_welcome_message" defaultValue={settings.ai_welcome_message ?? ""} />
          </Field>
        </Section>
        <Section title="Comportamento" desc="O que o assistente deve priorizar ou evitar. Soma às regras fixas de segurança.">
          <AiBehaviorField defaultValue={settings.ai_behavior ?? ""} modules={modules} />
        </Section>
      </>
    ),

    contato: (
      <Section title="Contato" desc="Endereço e canais do seu negócio. Também preenchem os documentos.">
        <Field label="Endereço">
          <Input name="footer_address" defaultValue={settings.footer_address ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input name="footer_phone" type="tel" defaultValue={settings.footer_phone ?? ""} />
          </Field>
          <Field label="WhatsApp">
            <Input name="footer_whatsapp" type="tel" defaultValue={settings.footer_whatsapp ?? ""} />
          </Field>
        </div>
        <Field label="Site">
          <Input name="footer_website" defaultValue={settings.footer_website ?? ""} />
        </Field>
      </Section>
    ),
  };

  const showPreview = PREVIEW_TABS.includes(active);
  const inForm = FORM_TABS.includes(active);

  return (
    <div className="@container">
      <nav aria-label="Seções da customização" className="mb-6 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-current={t.key === active ? "true" : undefined}
            onClick={(e) => {
              setActive(t.key);
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "center" });
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:-outline-offset-2",
              t.key === active
                ? "border-[var(--primary)] text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            <Icon name={t.icon} className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      <div className={cn("grid items-start gap-6", showPreview ? "@3xl:grid-cols-[minmax(0,1fr)_320px]" : "max-w-3xl")}>
        <div className="min-w-0">
          {/* Fora do form: têm forms próprios e HTML não permite aninhar. */}
          {hasProfileFieldsActions && (
            <div hidden={active !== "cadastro"}>
              <Section
                title="Campos do cadastro"
                desc="O que o cliente preenche no perfil, além de nome e e-mail. Arraste para reordenar."
              >
                <ProfileFieldsList
                  fields={profileFields ?? []}
                  createAction={createProfileFieldAction}
                  updateAction={updateProfileFieldAction}
                  deleteAction={deleteProfileFieldAction}
                  reorderAction={reorderProfileFieldsAction}
                />
              </Section>
            </div>
          )}
          {businessPanel && <div hidden={active !== "negocio"}>{businessPanel}</div>}

          <form
            ref={formRef}
            action={saveAction}
            onChange={refresh}
            onClick={refresh}
            // Campo inválido em aba escondida travaria o envio sem explicação.
            onInvalidCapture={(e) => {
              if (formRef.current?.querySelector(":invalid") !== e.target) return;
              const key = (e.target as HTMLElement).closest<HTMLElement>("[data-panel]")?.dataset.panel;
              if (key) flushSync(() => setActive(key));
            }}
            // Sem o reset automático do React: um erro não apaga o que foi digitado.
            onSubmit={(e) => {
              e.preventDefault();
              if (saving) return;
              const formData = new FormData(e.currentTarget);
              submitted.current = readValues(e.currentTarget);
              startSaving(() => saveAction(formData));
            }}
          >
            {/* Abas inativas só ficam escondidas: todo campo precisa ir no envio. */}
            <div key={resetKey}>
              {FORM_TABS.map((key) => (
                <div key={key} data-panel={key} hidden={key !== active}>
                  <div className="space-y-5">{panels[key]}</div>
                </div>
              ))}
            </div>

            {(inForm || dirty) && (
              <div className="sticky bottom-4 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_8px_24px_-8px_rgb(16_24_40/0.18)] backdrop-blur">
                <p role="status" className={cn("text-sm", dirty ? "font-medium" : "text-muted")}>
                  {dirty ? "Alterações não salvas" : "Tudo salvo"}
                </p>
                <div className="flex gap-2">
                  {dirty && (
                    <Button type="button" variant="ghost" disabled={saving} onClick={() => setResetKey((k) => k + 1)}>
                      Descartar
                    </Button>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving && <Spinner />}
                    {saving ? "Salvando…" : "Salvar alterações"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </div>

        {showPreview && (
          <aside aria-label="Prévia do portal" className="min-w-0 @3xl:sticky @3xl:top-6">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">Prévia</span>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[var(--primary)] hover:underline"
              >
                Abrir portal <Icon name="external" className="h-3.5 w-3.5" />
              </a>
            </div>
            <CustomizationPreview
              tenantName={tenantName}
              settings={liveSettings}
              view={active}
              profileFields={profileFields}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function BrandColors({ primary, secondary }: { primary: string; secondary: string }) {
  const [colors, setColors] = useState({ primary, secondary });

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PALETTES.map((p) => {
          const selected = p.primary === colors.primary && p.secondary === colors.secondary;
          return (
            <button
              key={p.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setColors({ primary: p.primary, secondary: p.secondary })}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                selected ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-line hover:bg-surface-2",
              )}
            >
              <span
                className="h-5 w-5 rounded-full"
                style={{ background: `linear-gradient(135deg, ${p.primary} 50%, ${p.secondary} 50%)` }}
              />
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(["primary", "secondary"] as const).map((k) => (
          <Field key={k} label={k === "primary" ? "Principal" : "Secundária"}>
            <span className="flex items-center gap-3">
              <input
                type="color"
                name={`${k}_color`}
                value={colors[k]}
                onChange={(e) => {
                  const { value } = e.target;
                  setColors((c) => ({ ...c, [k]: value }));
                }}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent p-1"
              />
              <span className="text-sm uppercase tabular-nums text-muted">{colors[k]}</span>
            </span>
          </Field>
        ))}
      </div>
    </>
  );
}

function ThemeOption({
  value,
  label,
  icon,
  current,
}: {
  value: string;
  label: string;
  icon: IconKey;
  current: string;
}) {
  return (
    <label className="flex relative cursor-pointer items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-medium transition hover:bg-surface-2 has-checked:border-[var(--primary)] has-checked:bg-[var(--primary)]/5 has-checked:text-[var(--primary)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[var(--primary)]">
      <input type="radio" name="theme_mode" value={value} defaultChecked={current === value} className="sr-only" />
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 text-sm">
      <span className="font-medium">{label}</span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-6 w-11 rounded-full bg-black/20 transition peer-checked:bg-[var(--primary)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] dark:bg-white/20" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
