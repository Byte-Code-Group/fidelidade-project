import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULES, getTemplate } from "@/lib/segment-templates";
import type { Tenant, TenantSettings } from "@/lib/types";
import {
  updateTenantCore,
  updateTenantSettings,
  uploadLogo,
  activateTenantBilling,
  cancelTenantBilling,
} from "../../../actions";
import { CustomizationForm } from "./customization-form";
import { getSubscription } from "@/lib/asaas";

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

  // Fetch subscription status from Asaas if exists
  let subscription: { status: string; nextDueDate: string; value: number } | null = null;
  if (tenant.asaas_subscription_id && process.env.ASAAS_API_KEY) {
    try {
      subscription = await getSubscription(tenant.asaas_subscription_id);
    } catch {
      // ignore — Asaas offline or invalid ID
    }
  }

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
          <Field label="E-mail do responsável" hint="usado no billing">
            <Input
              name="owner_email"
              type="email"
              defaultValue={tenant.owner_email ?? ""}
              placeholder="dono@empresa.com.br"
            />
          </Field>
          <Field label="CPF / CNPJ do responsável" hint="obrigatório no Asaas">
            <Input
              name="owner_cpf_cnpj"
              defaultValue={tenant.owner_cpf_cnpj ?? ""}
              placeholder="00.000.000/0001-00"
            />
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
              <option value="starter">Starter — R$ 97/mês</option>
              <option value="pro">Pro — R$ 297/mês</option>
              <option value="premium">Premium — R$ 697/mês</option>
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

      {/* ---------- Billing Asaas ---------- */}
      <Section title="Billing">
        {subscription ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="opacity-50">Status</p>
                <p className="font-medium capitalize">{subscription.status}</p>
              </div>
              <div>
                <p className="opacity-50">Próximo vencimento</p>
                <p className="font-medium">{subscription.nextDueDate}</p>
              </div>
              <div>
                <p className="opacity-50">Valor</p>
                <p className="font-medium">
                  {subscription.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                  /mês
                </p>
              </div>
            </div>
            <form action={cancelTenantBilling.bind(null, id)}>
              <Button type="submit" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                Cancelar assinatura
              </Button>
            </form>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm opacity-60">
              {tenant.asaas_subscription_id
                ? "Assinatura encontrada, mas ASAAS_API_KEY não está configurada neste ambiente."
                : "Nenhuma assinatura ativa. Ative o billing para cobrar automaticamente via Pix."}
            </p>
            {!tenant.asaas_subscription_id && (
              <form action={activateTenantBilling.bind(null, id)} className="flex items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs opacity-50">Forma de cobrança</label>
                  <Select name="billing_type" defaultValue="PIX">
                    <option value="PIX">PIX (gerado mensalmente)</option>
                    <option value="BOLETO">Boleto bancário</option>
                  </Select>
                </div>
                <Button type="submit" disabled={!tenant.owner_email || !tenant.owner_cpf_cnpj}>
                  Criar assinatura
                </Button>
              </form>
            )}
          </div>
        )}
      </Section>

      {/* ---------- Customização com preview ao vivo ---------- */}
      <CustomizationForm
        tenantName={tenant.name}
        segment={tenant.segment_template}
        templateLabel={tpl.label}
        templateEmoji={tpl.emoji}
        portalUrl={tenant.custom_domain ? `https://${tenant.custom_domain}` : `/p/${tenant.slug}`}
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
