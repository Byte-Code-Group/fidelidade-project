import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/icons";
import { AiBehaviorField } from "@/components/ai-behavior-field";
import { LogoUploadForm } from "@/components/logo-upload-form";
import { ProfileFieldsList } from "@/components/profile-fields-list";
import { Section, Field } from "@/components/ui/section";
import { CustomizationTabs } from "@/components/ui/customization-tabs";
import type { ProfileField, TenantSettings } from "@/lib/types";

interface CustomizationFormProps {
  tenantName: string;
  templateLabel: string;
  templateEmoji: string;
  templateHref?: string;
  portalUrl: string;
  settings: TenantSettings;
  allowedModules: { key: string; label: string }[];
  saveAction: (formData: FormData) => void;
  uploadAction: (formData: FormData) => void;
  profileFields?: ProfileField[];
  createProfileFieldAction?: (formData: FormData) => Promise<{ error?: string }>;
  updateProfileFieldAction?: (fieldId: string, formData: FormData) => Promise<{ error?: string }>;
  deleteProfileFieldAction?: (fieldId: string) => Promise<{ error?: string }>;
  reorderProfileFieldsAction?: (orderedIds: string[]) => Promise<{ error?: string }>;
}

// Editor de customização — form 100% nativo (sem JS obrigatório). Para ver o
// resultado, o link "Ver como ficou" abre o portal real do tenant numa aba.
export function CustomizationForm({
  tenantName,
  templateLabel,
  templateEmoji,
  templateHref,
  portalUrl,
  settings,
  allowedModules,
  saveAction,
  uploadAction,
  profileFields,
  createProfileFieldAction,
  updateProfileFieldAction,
  deleteProfileFieldAction,
  reorderProfileFieldsAction,
}: CustomizationFormProps) {
  const modules = (settings.modules_enabled ?? {}) as Record<string, boolean>;

  const hasProfileFieldsActions =
    createProfileFieldAction &&
    updateProfileFieldAction &&
    deleteProfileFieldAction &&
    reorderProfileFieldsAction;

  const tabs = [
    { key: "marca", label: "Marca", icon: "sparkles" as const },
    { key: "paginas", label: "Páginas", icon: "grid" as const },
    { key: "fidelidade", label: "Fidelidade", icon: "award" as const },
    { key: "ia", label: "Assistente IA", icon: "chat" as const },
    { key: "rodape", label: "Rodapé", icon: "building" as const },
    ...(hasProfileFieldsActions
      ? [{ key: "cadastro", label: "Campos do cadastro", icon: "users" as const }]
      : []),
  ];

  const panels: Record<string, React.ReactNode> = {
    marca: (
      <>
        <Section title="Logo da empresa" desc="Aparece na carteirinha e no topo do portal.">
          {/* A miniatura vive dentro do LogoUploadForm p/ virar preview do
              arquivo escolhido enquanto o upload acontece. */}
          <LogoUploadForm
            uploadAction={uploadAction}
            logoUrl={settings.logo_url}
            fallbackLabel={tenantName}
            fallbackColor={settings.primary_color}
          />
        </Section>

        <Section title="Marca">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cor primária">
              <ColorRow name="primary_color" value={settings.primary_color} />
            </Field>
            <Field label="Cor secundária">
              <ColorRow name="secondary_color" value={settings.secondary_color} />
            </Field>
          </div>
          <Field label="Tema padrão" hint="cada cliente pode alternar claro/escuro no portal">
            <Select name="theme_mode" defaultValue={settings.theme_mode}>
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </Select>
          </Field>
        </Section>

        <Section title="Nomenclatura">
          <div className="grid grid-cols-2 gap-4">
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

    paginas: (
      <Section
        title="Páginas do portal"
        desc={`Limitado ao template ${templateEmoji} ${templateLabel}. Dá pra desativar, não adicionar.`}
        action={
          templateHref ? (
            <Link
              href={templateHref}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Ver template
            </Link>
          ) : undefined
        }
      >
        {allowedModules.length === 0 ? (
          <p className="rounded-lg bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
            Este template não tem páginas opcionais — só as páginas base.
          </p>
        ) : (
          <div className="space-y-2">
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
    ),

    fidelidade: (
      <Section title="Fidelidade">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Meta">
            <Input name="loyalty_goal" type="number" min={1} defaultValue={settings.loyalty_goal} />
          </Field>
          <Field label="Frequência">
            <Select name="loyalty_frequency" defaultValue={settings.loyalty_frequency}>
              <option value="monthly">Mensal</option>
              <option value="weekly">Semanal</option>
              <option value="per_visit">Por visita</option>
            </Select>
          </Field>
          <Field label="Pts/visita">
            <Input
              name="loyalty_points_per_checkin"
              type="number"
              min={1}
              defaultValue={settings.loyalty_points_per_checkin}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="loyalty_streak_reset"
            defaultChecked={settings.loyalty_streak_reset}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Zerar progresso ao falhar um período
        </label>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome da recompensa">
            <Input name="reward_name" defaultValue={settings.reward_name ?? ""} />
          </Field>
          <Field label="Descrição da recompensa">
            <Input name="reward_description" defaultValue={settings.reward_description ?? ""} />
          </Field>
        </div>
      </Section>
    ),

    ia: (
      <Section title="Assistente IA">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do assistente">
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
        {/* Label/hint moram dentro do componente — os botões de modelo não
            podem ficar dentro do <label> do Field (clique roubado). */}
        <AiBehaviorField
          defaultValue={settings.ai_behavior ?? ""}
          modules={modules}
        />
      </Section>
    ),

    rodape: (
      <Section title="Rodapé / contato">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Endereço">
            <Input name="footer_address" defaultValue={settings.footer_address ?? ""} />
          </Field>
          <Field label="Telefone">
            <Input name="footer_phone" defaultValue={settings.footer_phone ?? ""} />
          </Field>
          <Field label="WhatsApp">
            <Input name="footer_whatsapp" defaultValue={settings.footer_whatsapp ?? ""} />
          </Field>
          <Field label="Site">
            <Input name="footer_website" defaultValue={settings.footer_website ?? ""} />
          </Field>
        </div>
      </Section>
    ),

    ...(hasProfileFieldsActions
      ? {
          cadastro: (
            <Section
              title="Campos do cadastro"
              desc="Dados que o cliente preenche no perfil. Nome e e-mail já vêm prontos; adicione outros como CPF, endereço, data de nascimento ou campos personalizados. Arraste pelo ⠿ pra reordenar."
            >
              <ProfileFieldsList
                fields={profileFields ?? []}
                createAction={createProfileFieldAction!}
                updateAction={updateProfileFieldAction!}
                deleteAction={deleteProfileFieldAction!}
                reorderAction={reorderProfileFieldsAction!}
              />
            </Section>
          ),
        }
      : {}),
  };

  return (
    <div className="space-y-5">
      {/* Barra com link de visualização */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white/70 px-5 py-4 dark:bg-white/5">
        <div>
          <h2 className="font-semibold">Customização do portal</h2>
          <p className="text-xs opacity-55">
            Edite, salve e veja o resultado no portal real.
          </p>
        </div>
        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Icon name="arrowRight" className="mr-2 h-4 w-4" /> Ver como ficou
          </Button>
        </a>
      </div>

      <CustomizationTabs
        tabs={tabs}
        panels={panels}
        formId="customization-form"
        saveAction={saveAction}
        formTabKeys={["marca", "paginas", "fidelidade", "ia", "rodape"]}
        footer={
          <div className="flex items-center justify-end gap-3">
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" type="button">Ver como ficou ↗</Button>
            </a>
            <Button type="submit" pendingLabel="Salvando…">
              Salvar customização
            </Button>
          </div>
        }
      />
    </div>
  );
}

/* ---------------- subcomponentes (sem JS) ---------------- */

// Color picker nativo: a escolha já é submetida no name; mostra o hex ao lado.
function ColorRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        name={name}
        defaultValue={value}
        aria-label="Escolher cor"
        className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-transparent p-1"
      />
      <span className="font-mono text-sm uppercase opacity-60">{value}</span>
    </div>
  );
}

// Switch puramente CSS (peer-checked) — funciona sem hidratação.
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
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-sm transition hover:bg-black/[0.02]">
      <span className="font-medium">{label}</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          name={name}
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-black/20 transition peer-checked:bg-[var(--primary)]" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
