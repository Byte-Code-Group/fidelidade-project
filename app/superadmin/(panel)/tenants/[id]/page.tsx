import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULES, getTemplate } from "@/lib/segment-templates";
import type { Tenant, TenantSettings } from "@/lib/types";
import { updateTenantCore, updateTenantSettings, uploadLogo } from "../../../actions";
import { CustomizationForm } from "./customization-form";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

export default async function EditTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle<Tenant>();
  if (!tenant) notFound();

  const { data: settings } = await db
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", id)
    .maybeSingle<TenantSettings>();
  if (!settings) notFound();

  // Teto do template: só estes módulos podem ser ativados nesta empresa.
  const tpl = getTemplate(tenant.segment_template);
  const allowedModules = MODULES.filter((m) =>
    tpl.modules.includes(m.key),
  ).map((m) => ({ key: m.key as string, label: m.label }));

  return (
    <div className="space-y-5">
      {saved && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">
          ✓ Alterações salvas.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ---------- Dados da conta ---------- */}
      <Section title="Conta">
        <form
          action={updateTenantCore.bind(null, id)}
          className="grid grid-cols-2 gap-4"
        >
          <Field label="Nome" hint={`subdomínio: ${tenant.slug}.${ROOT_DOMAIN}`}>
            <Input name="name" defaultValue={tenant.name} required />
          </Field>
          <Field label="Domínio próprio" hint="opcional">
            <Input
              name="custom_domain"
              defaultValue={tenant.custom_domain ?? ""}
              placeholder="clinica.com.br"
            />
          </Field>
          <Field label="Plano SaaS">
            <Select name="saas_plan" defaultValue={tenant.saas_plan}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="premium">Premium</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={tenant.status}>
              <option value="trial">Trial</option>
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
            </Select>
          </Field>
          <div className="col-span-2">
            <Button type="submit">Salvar conta</Button>
          </div>
        </form>
      </Section>

      {/* ---------- Customização com preview ao vivo ---------- */}
      <CustomizationForm
        tenantName={tenant.name}
        segment={tenant.segment_template}
        templateLabel={tpl.label}
        templateEmoji={tpl.emoji}
        portalUrl={`http://${tenant.slug}.${ROOT_DOMAIN}`}
        settings={settings}
        allowedModules={allowedModules}
        saveAction={updateTenantSettings.bind(null, id)}
        uploadAction={uploadLogo.bind(null, id)}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <h2 className="font-semibold">{title}</h2>
        {children}
      </CardContent>
    </Card>
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
