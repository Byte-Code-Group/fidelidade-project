import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/icons";
import { LogoUploadForm } from "@/components/logo-upload-form";
import { ProfileFieldsList } from "@/components/profile-fields-list";
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
  createProfileFieldAction?: (formData: FormData) => void;
  updateProfileFieldAction?: (fieldId: string, formData: FormData) => void;
  deleteProfileFieldAction?: (fieldId: string) => void;
  reorderProfileFieldsAction?: (orderedIds: string[]) => void;
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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

      {/* Logo */}
      <Section title="Logo da empresa" desc="Aparece na carteirinha e no topo do portal.">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:bg-white/10">
            {settings.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logo_url} alt="logo" className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center text-xl font-bold text-white"
                style={{ background: settings.primary_color }}
              >
                {tenantName.charAt(0)}
              </div>
            )}
          </div>
          <LogoUploadForm uploadAction={uploadAction} />
        </div>
      </Section>

      {/* Form principal (nativo) */}
      <form action={saveAction} className="space-y-5">
        {/* Marca */}
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

        {/* Nomenclatura */}
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

        {/* Páginas */}
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

        {/* Fidelidade */}
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

        {/* Assistente IA */}
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
        </Section>

        {/* Rodapé */}
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

        <div className="flex items-center justify-end gap-3">
          <a href={portalUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" type="button">Ver como ficou ↗</Button>
          </a>
          <Button type="submit">Salvar customização</Button>
        </div>
      </form>

      {/* Campos do cadastro — formulários independentes (não aninham no form acima) */}
      {createProfileFieldAction &&
        updateProfileFieldAction &&
        deleteProfileFieldAction &&
        reorderProfileFieldsAction && (
          <Section
            title="Campos do cadastro"
            desc="Dados que o cliente preenche no perfil. Nome e e-mail já vêm prontos; adicione outros como CPF, endereço, data de nascimento ou campos personalizados. Arraste pelo ⠿ pra reordenar."
          >
            <ProfileFieldsList
              fields={profileFields ?? []}
              createAction={createProfileFieldAction}
              updateAction={updateProfileFieldAction}
              deleteAction={deleteProfileFieldAction}
              reorderAction={reorderProfileFieldsAction}
            />
          </Section>
        )}
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

function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/70 p-5 shadow-sm dark:bg-white/5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-xs opacity-55">{desc}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal opacity-50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
